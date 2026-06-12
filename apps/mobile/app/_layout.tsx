import ChangelogModal from '@/components/changelog-modal';
import { SidebarProvider } from '@/context/sidebar-context';
import { fileSyncService } from '@annota/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider } from '@react-navigation/native';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as BackgroundTask from 'expo-background-task';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useShareIntent } from 'expo-share-intent';
import { openDatabaseSync } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import * as TaskManager from 'expo-task-manager';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast, { type ToastConfig, type ToastConfigParams } from 'react-native-toast-message';
import 'react-native-url-polyfill/auto';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useAppTheme } from '@/hooks/use-app-theme';
import { useDailyCleanup } from '@/hooks/use-daily-cleanup';
import { useDisplayNameSync } from '@/hooks/use-display-name-sync';
import RevenueCatInitializer, { logInRevenueCat, logOutRevenueCat } from '@/services/RevenueCat';
import {
  authApi,
  initDatabase,
  initDb,
  setStorageEngine,
  useUserStore as useAuthStore,
  useDbStore,
  useNotesStore,
  useSearchStore,
  useSettingsStore,
  useSyncStore,
  isCloudEnabled,
} from '@annota/core';
import { SyncScheduler, getMasterKey, initPlatformAdapters } from '@annota/core/platform';
import { createMobileAdapters } from '../bootstrap/mobile-adapters';
import { ensureEditorHtmlCache } from '@annota/editor-ui';

setStorageEngine(AsyncStorage);
initPlatformAdapters(createMobileAdapters());

const BACKGROUND_SYNC_TASK = 'BACKGROUND_SYNC_TASK';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const NetInfo = require('@react-native-community/netinfo').default;
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      console.log("[BackgroundSync] Skipped: device is offline");
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    const { authApi } = require('@annota/core');
    const { syncPull, syncPush } = require('@annota/core');
    const { getMasterKey } = require('@annota/core/platform');

    const { data: { session } } = await authApi.getSession();
    if (!session) return BackgroundTask.BackgroundTaskResult.Success;

    const { appConfigService } = require('@annota/core');
    await appConfigService.init();

    const key = await getMasterKey(session.user.id);
    if (!key) return BackgroundTask.BackgroundTaskResult.Success;

    const { useSyncStore, useUserStore } = require('@annota/core');
    await useUserStore.persist.rehydrate();
    const saltHex = useUserStore.getState().saltHex;
    if (!saltHex) return BackgroundTask.BackgroundTaskResult.Success;
    await useSyncStore.getState().loadSyncCursors(session.user.id);

    await syncPull(key, saltHex);
    await syncPush(key, saltHex);

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error("[BackgroundSync] Failed:", error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

type MobileDbBundle = {
  expoDb: ReturnType<typeof openDatabaseSync>;
  drizzleDb: ReturnType<typeof drizzle>;
};

const mobileDbCache = new Map<string, MobileDbBundle>();

const getOrCreateMobileDb = async (userId: string | null): Promise<MobileDbBundle> => {
  const cacheKey = userId ?? '__guest__';
  const existing = mobileDbCache.get(cacheKey);
  if (existing) return existing;

  const dbName = userId ? `user_${userId}.db` : 'local_guest.db';
  const expoDb = openDatabaseSync(dbName);
  const drizzleDb = drizzle(expoDb);

  await initDatabase({
    execAsync: (sql: string) => expoDb.execAsync(sql),
    selectAsync: (sql: string, params: any[]) => expoDb.getAllAsync(sql, params)
  }, drizzleDb as any);
  const bundle = { expoDb, drizzleDb };
  mobileDbCache.set(cacheKey, bundle);
  return bundle;
};

function CustomToast({ text1, text2, type }: ToastConfigParams<any> & { type?: 'success' | 'error' | 'info' | 'offline' | 'online' }) {
  let iconName: keyof typeof Ionicons.glyphMap = 'information-circle';
  let iconColor = '#3B82F6';

  if (type === 'success') {
    iconName = 'checkmark-circle';
    iconColor = '#10B981';
  } else if (type === 'error') {
    iconName = 'alert-circle';
    iconColor = '#EF4444';
  } else if (type === 'offline') {
    iconName = 'cloud-offline';
    iconColor = '#F59E0B';
  } else if (type === 'online') {
    iconName = 'cloud';
    iconColor = '#10B981';
  }

  return (
    <View style={toastStyles.container}>
      <Ionicons name={iconName} size={22} color={iconColor} style={toastStyles.icon} />
      <View style={toastStyles.textWrap}>
        <Text style={toastStyles.title}>{text1}</Text>
        {text2 ? <Text style={toastStyles.subtitle}>{text2}</Text> : null}
      </View>
    </View>
  );
}

const toastConfig: ToastConfig = {
  offlineToast: (props: any) => <CustomToast {...props} type="offline" />,
  onlineToast: (props: any) => <CustomToast {...props} type="online" />,
  error: (props: any) => <CustomToast {...props} type="error" />,
  success: (props: any) => <CustomToast {...props} type="success" />,
  info: (props: any) => <CustomToast {...props} type="info" />,
};

const STARTUP_NETWORK_TIMEOUT_MS = 5000;

class StartupTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StartupTimeoutError';
  }
}

const withStartupTimeout = async <T,>(
  promise: Promise<T>,
  label: string,
  timeoutMs: number = STARTUP_NETWORK_TIMEOUT_MS,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new StartupTimeoutError(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const isStartupTimeout = (error: unknown) =>
  error instanceof StartupTimeoutError;

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SidebarProvider>
        <AppLogicHub />
      </SidebarProvider>
    </GestureHandlerRootView>
  );
}

function AppLogicHub() {
  const theme = useAppTheme();
  const { initialized, session, user, isGuest, setSession, hasMasterKey, checkMasterKey, getUserProfile, saltHex } = useAuthStore();
  const dbReady = useDbStore(state => state.isReady);
  const initDB = useDbStore(state => state.initDB);
  const [dbError, setDbError] = useState<string | null>(null);
  const schedulerRef = useRef<SyncScheduler | null>(null);
  const segments = useSegments();
  const router = useRouter();

  // ── Share Intent ─────────────────────────────────────────────────────────
  // expo-share-intent delivers the URL shared from Safari/Chrome here.
  // We gate navigation on dbReady + initialized so the share screen can
  // safely call createNote without the DB being cold.
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  useEffect(() => {
    if (!hasShareIntent) return;
    if (!dbReady || !initialized) return;

    const webUrl = shareIntent?.webUrl;
    if (!webUrl) {
      // Intent arrived but has no URL — clear it and do nothing
      resetShareIntent();
      return;
    }

    router.push({
      pathname: '/share',
      params: {
        url: webUrl,
        title: shareIntent.text ?? '',
      },
    });
    resetShareIntent();
  }, [hasShareIntent, dbReady, initialized, shareIntent, resetShareIntent, router]);

  // 1. Auth Listener & Hydration (Runs only once at startup)
  useEffect(() => {
    let isMounted = true;
    let subscription: any = null;

    ensureEditorHtmlCache().catch((err) => {
      console.error('[RootLayout] Failed to cache editor HTML:', err);
    });

    const initAuth = async () => {
      try {
        console.log('[RootLayout] Starting auth hydration...');
        await useAuthStore.persist.rehydrate();
        await useSettingsStore.persist.rehydrate();
        const { useAiStore } = require('@annota/core');
        await useAiStore.persist.rehydrate();

        // Initialize online status early on mobile
        const NetInfo = require('@react-native-community/netinfo').default;
        const netState = await NetInfo.fetch();
        const initialOnline = !!netState.isConnected && !!netState.isInternetReachable;
        useSyncStore.getState().setOnline(initialOnline);

        if (!isCloudEnabled) {
          useAuthStore.getState().setGuest(true);
          if (isMounted && !useAuthStore.getState().initialized) {
            useAuthStore.setState({ initialized: true });
          }
        } else {
          const { appConfigService } = require('@annota/core'); // Keep this require if it's truly problematic as top-level due to side effects
          try {
            await withStartupTimeout(appConfigService.init(), 'App config');
          } catch (err) {
            console.warn('[RootLayout] App config init timed out/failed. Proceeding offline.', err);
            if (isStartupTimeout(err)) {
              useSyncStore.getState().setOnline(false);
            }
          }

          subscription = authApi.onAuthStateChange((event, session) => {
            if (!isMounted) return;
            console.log('[RootLayout] Auth state change:', event);
            if (session) {
              const prevUserId = useAuthStore.getState().user?.id ?? null;
              if (session.user.id !== prevUserId) {
                useNotesStore.getState().reset();
                useSearchStore.getState().reset();
                useSyncStore.getState().reset();
              }
              setSession(session);
              getUserProfile();
              logInRevenueCat(session.user.id);
            } else if (event === 'SIGNED_OUT') {
              setSession(null);
              logOutRevenueCat();
              useNotesStore.getState().reset();
              useSearchStore.getState().reset();
              useSyncStore.getState().reset();
            } else if (!useAuthStore.getState().initialized) {
              useAuthStore.setState({ initialized: true });
            }
          });

          try {
            if (useSyncStore.getState().isOnline) {
              const { data: { session: currentSession } } = await withStartupTimeout(
                authApi.getSession(),
                'Session restore',
              );
              if (isMounted) {
                if (currentSession) {
                  setSession(currentSession);
                } else if (useAuthStore.getState().session) {
                  // If we had a session rehydrated but Supabase says no session,
                  // it means the token is expired/invalid. Set authRequired.
                  useSyncStore.getState().setAuthRequired(true);
                }
              }
            }
          } catch (err) {
            console.warn('[RootLayout] Session restore delayed/failed (offline likely).', err);
            if (isStartupTimeout(err)) {
              useSyncStore.getState().setOnline(false);
            }
          } finally {
            if (isMounted && !useAuthStore.getState().initialized) {
              useAuthStore.setState({ initialized: true });
            }
          }
        }
      } catch (err) {
        console.error('[RootLayout] initAuth error:', err);
        if (isMounted && !useAuthStore.getState().initialized) {
          useAuthStore.setState({ initialized: true });
        }
      }
    };

    initAuth();
    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  // 2. Identity-driven Bootstrap (DB + Data Loading)
  useEffect(() => {
    if (!initialized) return;

    const runBootstrap = async () => {
      try {
        const userId = session?.user?.id || user?.id || null;
        console.log('[RootLayout] Bootstrapping for identity:', userId || 'guest');

        const { expoDb, drizzleDb } = await getOrCreateMobileDb(userId);
        initDb(drizzleDb as any);
        initDB(userId, expoDb);

        // Once DB is configured, load the in-memory stores
        console.log('[RootLayout] Loading stores data...');
        await Promise.all([
          useNotesStore.getState().initApp()
        ]);

        if (session) {
          checkMasterKey();
          getUserProfile();
          logInRevenueCat(session.user.id);
        } else if (user) {
          getUserProfile();
        }

        console.log('[RootLayout] Bootstrap complete.');
      } catch (e) {
        console.error('[RootLayout] Bootstrap failed:', e);
        setDbError(e instanceof Error ? e.message : 'Unknown error');
      }
    };

    runBootstrap();
  }, [initialized, session?.user?.id, user?.id, isGuest]);

  // 4. Redirection Guard
  useEffect(() => {
    if (!initialized || !dbReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isAuthenticated = !!session || !!user || isGuest;

    if (!isAuthenticated) {
      if (!inAuthGroup) {
        if (router.canDismiss()) router.dismissAll();
        router.replace('/(auth)');
      }
      return;
    }

    if (session || user) {
      if (hasMasterKey === null) return;
      if (hasMasterKey === false) {
        if (segments[1] !== 'master-key' && segments[1] !== 'lost-key') {
          router.replace('/(auth)/master-key');
        }
      } else {
        if (inAuthGroup && segments[1] !== 'master-key' && segments[1] !== 'lost-key') {
          router.replace('/(app)');
        }
      }
    } else if (isGuest) {
      if (inAuthGroup) {
        router.replace('/(app)');
      }
    }
  }, [session, isGuest, initialized, dbReady, segments, hasMasterKey]);

  // 5. Sync Scheduler & Background Fetch
  useEffect(() => {
    if (!session || !dbReady || !hasMasterKey || !saltHex) return;
    let cancelled = false;

    const runAfterIdle = (callback: () => void) => {
      if (typeof requestIdleCallback !== 'undefined') {
        return requestIdleCallback(callback);
      }
      return setTimeout(callback, 500);
    };

    runAfterIdle(async () => {
      if (cancelled) return;
      const key = await getMasterKey(session.user.id);
      if (!key || cancelled) return;

      // Register global converter for sync engine to avoid compile-time resolution issues
      const { ExportService } = await import('@annota/editor-core');
      const { MobileExportAdapter } = await import('../utils/export/MobileExportAdapter');
      const service = new ExportService(new MobileExportAdapter());
      (globalThis as any).__annota_markdown_converter = async (content: string) => {
        return await service.convertToMarkdown(content);
      };

      const scheduler = SyncScheduler.getInstance();
      schedulerRef.current = scheduler;
      scheduler.init(key, saltHex, {
        reinitStores: async () => {
          await Promise.all([
            useNotesStore.getState().initApp(),
          ]);
        },
        getSyncState: () => {
          const state = useSyncStore.getState();
          return {
            isOnline: state.isOnline,
            syncError: state.syncError,
            setOnline: state.setOnline
          };
        }
      }, session.user.id);

      fileSyncService.retryPendingDownloads(key, saltHex, session.user.id).catch(() => { });
    });

    return () => {
      cancelled = true;
      schedulerRef.current?.dispose();
    };
  }, [session, dbReady, hasMasterKey, saltHex]);


  useEffect(() => {
    if (!session || !dbReady) return;
    const registerBackgroundFetch = async () => {
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
        if (!isRegistered) {
          await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, { minimumInterval: 15 });
        }
      } catch (err) { }
    };
    registerBackgroundFetch();
  }, [session, dbReady]);

  useDailyCleanup();
  useDisplayNameSync();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.background);
  }, [theme.colors.background]);

  if (!dbReady || !initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        {dbError ? <Text style={{ color: '#ff6b6b' }}>Startup Error: {dbError}</Text> : null}
      </View>
    );
  }

  return (
    <ThemeProvider value={theme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Toast config={toastConfig} />
      <RevenueCatInitializer />
      <ChangelogModal />
    </ThemeProvider>
  );
}

const toastStyles = {
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    marginHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  icon: {
    marginRight: 2,
  },
  textWrap: {
    flex: 1,
    gap: 1,
    marginLeft: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    marginTop: 1,
  },
} as const;
