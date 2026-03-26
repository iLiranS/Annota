import { fileSyncService } from '@annota/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider } from '@react-navigation/native';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as BackgroundTask from 'expo-background-task';
import { Stack, useRouter, useSegments } from 'expo-router';
import { openDatabaseSync } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import * as TaskManager from 'expo-task-manager';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SidebarProvider } from '@/context/sidebar-context';
import Toast, { type ToastConfig, type ToastConfigParams } from 'react-native-toast-message';
import 'react-native-url-polyfill/auto';

import { useAppTheme } from '@/hooks/use-app-theme';
import { useDailyCleanup } from '@/hooks/use-daily-cleanup';
import { useDisplayNameSync } from '@/hooks/use-display-name-sync';
import { logInRevenueCat, logOutRevenueCat } from '@/services/RevenueCat';
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
  useTasksStore
} from '@annota/core';
import { SyncScheduler, getMasterKey, initPlatformAdapters } from '@annota/core/platform';
import { createMobileAdapters } from '../bootstrap/mobile-adapters';

setStorageEngine(AsyncStorage);
initPlatformAdapters(createMobileAdapters());

const BACKGROUND_SYNC_TASK = 'BACKGROUND_SYNC_TASK';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
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
    await useSyncStore.getState().loadLastSyncAt(session.user.id);

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

  await initDatabase(expoDb, drizzleDb as any);
  const bundle = { expoDb, drizzleDb };
  mobileDbCache.set(cacheKey, bundle);
  return bundle;
};

function CustomToast({ text1, text2, type }: ToastConfigParams<any> & { type?: 'success' | 'error' | 'info' }) {
  const isError = type === 'error';
  const isSuccess = type === 'success';

  return (
    <View style={[
      toastStyles.container,
      isError && { borderLeftWidth: 4, borderLeftColor: '#ff4b4b' },
      isSuccess && { borderLeftWidth: 4, borderLeftColor: '#10b981' }
    ]}>
      <View style={toastStyles.textWrap}>
        <Text style={[toastStyles.title, isError && { color: '#ff4b4b' }]}>{text1}</Text>
        {text2 ? <Text style={toastStyles.subtitle}>{text2}</Text> : null}
      </View>
    </View>
  );
}

const toastConfig: ToastConfig = {
  offlineToast: (props: any) => <CustomToast {...props} />,
  onlineToast: (props: any) => <CustomToast {...props} />,
  error: (props: any) => <CustomToast {...props} type="error" />,
  success: (props: any) => <CustomToast {...props} type="success" />,
  info: (props: any) => <CustomToast {...props} />,
};

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

  // 1. Auth Listener & Hydration (Runs only once at startup)
  useEffect(() => {
    let isMounted = true;
    let subscription: any = null;

    const initAuth = async () => {
      try {
        console.log('[RootLayout] Starting auth hydration...');
        await useAuthStore.persist.rehydrate();
        await useSettingsStore.persist.rehydrate();
        
        const { appConfigService } = require('@annota/core'); // Keep this require if it's truly problematic as top-level due to side effects
        await appConfigService.init();

        subscription = authApi.onAuthStateChange((event, session) => {
          if (!isMounted) return;
          console.log('[RootLayout] Auth state change:', event);
          if (session) {
            setSession(session);
            getUserProfile();
            logInRevenueCat(session.user.id);
          } else if (event === 'SIGNED_OUT') {
            setSession(null);
            logOutRevenueCat();
            useNotesStore.getState().reset();
            useTasksStore.getState().reset();
            useSearchStore.getState().reset();
            useSyncStore.getState().reset();
          } else if (!useAuthStore.getState().initialized) {
            useAuthStore.setState({ initialized: true });
          }
        });

        const { data: { session: currentSession } } = await authApi.getSession();
        if (isMounted) {
          if (currentSession) {
            setSession(currentSession);
          }
          if (!useAuthStore.getState().initialized) {
            useAuthStore.setState({ initialized: true });
          }
        }
      } catch (err) {
        console.error('[RootLayout] initAuth error:', err);
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
          useNotesStore.getState().initApp(),
          useTasksStore.getState().loadTasks()
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

      const scheduler = SyncScheduler.getInstance();
      schedulerRef.current = scheduler;
      scheduler.init(key, saltHex, {
        reinitStores: async () => {
          await Promise.all([
            useNotesStore.getState().initApp(),
            useTasksStore.getState().loadTasks(),
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

      fileSyncService.retryPendingDownloads(key, saltHex, session.user.id).catch(() => {});
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
      } catch (err) {}
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
    </ThemeProvider>
  );
}

const toastStyles = {
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
} as const;
