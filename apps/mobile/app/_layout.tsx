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
import { InteractionManager, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import Toast, { type ToastConfig, type ToastConfigParams } from 'react-native-toast-message';
import 'react-native-url-polyfill/auto';


const BACKGROUND_SYNC_TASK = 'BACKGROUND_SYNC_TASK';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const { authApi } = require('@annota/core');
    const { syncPull, syncPush } = require('@annota/core');
    const { getMasterKey } = require('@annota/core/platform');

    const { data: { session } } = await authApi.getSession();
    if (!session) return BackgroundTask.BackgroundTaskResult.Success;

    // Fetch/Apply remote app config before running sync
    const { appConfigService } = require('@annota/core');
    await appConfigService.init();

    const key = await getMasterKey(session.user.id);
    if (!key) return BackgroundTask.BackgroundTaskResult.Success;

    // Hydrate sync pointer so we only pull changes since last sync
    const { useSyncStore } = require('@annota/core');
    await useSyncStore.getState().loadLastSyncAt(session.user.id);

    // Note: For background fetch, doing heavy operations must be well bounded
    await syncPull(key);
    await syncPush(key);

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error("[BackgroundSync] Failed:", error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

import { useAppTheme } from '@/hooks/use-app-theme';
import { useDailyCleanup } from '@/hooks/use-daily-cleanup';
import { useDisplayNameSync } from '@/hooks/use-display-name-sync';
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

type MobileDbBundle = {
  expoDb: ReturnType<typeof openDatabaseSync>;
  drizzleDb: ReturnType<typeof drizzle>;
};

const mobileDbCache = new Map<string, MobileDbBundle>();

const getOrCreateMobileDb = async (userId: string | null): Promise<MobileDbBundle> => {
  const cacheKey = userId ?? '__guest__';
  const existing = mobileDbCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const dbName = userId ? `user_${userId}.db` : 'local_guest.db';
  const expoDb = openDatabaseSync(dbName);
  const drizzleDb = drizzle(expoDb);

  await initDatabase(expoDb, drizzleDb as any);

  const bundle = { expoDb, drizzleDb };
  mobileDbCache.set(cacheKey, bundle);
  return bundle;
};

export const unstable_settings = {
  anchor: '(drawer)',
};

// ─── Custom Toast Config ────────────────────────────────────

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

// ─── Root Layout ─────────────────────────────────────────────

export default function RootLayout() {
  const theme = useAppTheme();
  const { initialized, session, user, isGuest, setSession, hasMasterKey, checkMasterKey } = useAuthStore();
  const dbReady = useDbStore(state => state.isReady);
  const initDB = useDbStore(state => state.initDB);
  const [dbError, setDbError] = useState<string | null>(null);
  const schedulerRef = useRef<SyncScheduler | null>(null);

  // Run daily background cleanups (e.g. old completed tasks)
  useDailyCleanup();

  // Sync display name for authenticated users once daily
  useDisplayNameSync();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.background);
  }, [theme.colors.background]);




  useEffect(() => {
    if (!initialized) return;

    const runBootstrap = async () => {
      try {
        const bootstrapDb = async (userId: string | null) => {
          const { expoDb, drizzleDb } = await getOrCreateMobileDb(userId);
          initDb(drizzleDb as any);
          initDB(userId, expoDb);
        };

        if (session) {
          checkMasterKey();
          useAuthStore.getState().getUserProfile();
          await bootstrapDb(session.user.id);
        } else if (user) {
          // Offline cold start — hasMasterKey is already restored from persist
          useAuthStore.getState().getUserProfile();
          await bootstrapDb(user.id);
        } else {
          // Fallback to guest DB for unauthenticated users (so the app can render the Auth screen)
          // Without this, dbReady stays false forever.
          await bootstrapDb(null);
        }
      } catch (e) {
        setDbError(e instanceof Error ? e.message : 'Unknown error');
      }
    };

    runBootstrap();
  }, [initialized, session?.user?.id, user?.id]);

  useEffect(() => {
    if (dbReady) {
      // Initialize store (load all data into memory)
      const { useNotesStore } = require('@annota/core');
      const { useTasksStore } = require('@annota/core');
      void useNotesStore.getState().initApp().catch((error: unknown) => {
        console.error('[RootLayout] Failed to initialize notes store:', error);
      });
      void useTasksStore.getState().loadTasks().catch((error: unknown) => {
        console.error('[RootLayout] Failed to initialize tasks store:', error);
      });



    }
  }, [dbReady, user?.id, isGuest]);

  useEffect(() => {
    let isMounted = true;
    let subscription: any = null;

    const initAuth = async () => {
      try {
        // 1. Rehydrate stores from AsyncStorage sequentially
        await useAuthStore.persist.rehydrate();
        await useSettingsStore.persist.rehydrate();

        // 1.5 Fetch/Apply remote app config (blocking sync if needed)
        const { appConfigService } = require('@annota/core');
        await appConfigService.init();
      } catch (err) {
        console.error('[RootLayout] Hydration/Config error:', err);
      }

      // 2. Hydration completes so properties like isGuest exist.
      // Now start listening to real auth changes
      subscription = authApi.onAuthStateChange((event, session) => {
        if (!isMounted) return;

        if (session) {
          setSession(session);
          useAuthStore.getState().getUserProfile();
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          // Clear stores immediately to prevent ghosting of previous user's data
          useNotesStore.getState().reset();
          useTasksStore.getState().reset();
          useSearchStore.getState().reset();
          useSyncStore.getState().reset();
        } else if (!useAuthStore.getState().initialized) {
          useAuthStore.setState({ initialized: true });
        }
      });

      // 3. Fallback request to make sure session connects
      authApi.getSession().then((result: any) => {
        if (isMounted && result?.data?.session) {
          setSession(result.data.session);
        } else if (isMounted && !useAuthStore.getState().initialized) {
          useAuthStore.setState({ initialized: true });
        }
      }).catch((error) => {
        console.warn('[RootLayout] Auth getSession failed (likely offline):', error);
        if (isMounted && !useAuthStore.getState().initialized) {
          useAuthStore.setState({ initialized: true });
        }
      });
    };

    initAuth();

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!initialized || !dbReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !isGuest && !user) {
      // User is not authenticated, has no persisted user context, nor a guest
      if (!inAuthGroup) {
        if (router.canDismiss()) {
          router.dismissAll();
        } else {
          router.replace('/(auth)');
        }
      }
    } else if (session || user) {
      // User is authenticated (or was previously offline-authenticated)
      if (hasMasterKey === null) return; // Wait until we verify local key exists

      if (hasMasterKey === false) {
        if (segments[1] !== 'master-key' && segments[1] !== 'lost-key') {
          router.replace('/(auth)/master-key');
        }
      } else {
        // hasMasterKey === true
        if (inAuthGroup && segments[1] !== 'master-key' && segments[1] !== 'lost-key') {
          router.replace('/(drawer)');
        }
      }
    } else if (isGuest) {
      // User is a guest
      if (inAuthGroup) {
        router.replace('/(drawer)');
      }
    }
  }, [session, isGuest, initialized, dbReady, segments, hasMasterKey]);

  // ─── Sync Scheduler ──────────────────────────────────────
  useEffect(() => {
    if (!session || !dbReady || !hasMasterKey) return;

    let cancelled = false;

    InteractionManager.runAfterInteractions(async () => {
      if (cancelled) return;

      const key = await getMasterKey(session.user.id);
      if (!key || cancelled) return;

      // 1. Start the main sync scheduler
      const scheduler = SyncScheduler.getInstance();
      schedulerRef.current = scheduler;
      scheduler.init(key, {
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

      // 2. Kick off any pending file downloads from previous sessions
      fileSyncService.retryPendingDownloads(key, session.user.id).catch((err: any) => {
        console.error('[Startup] Failed to retry pending files downloads:', err);
      });
    });
    return () => {
      cancelled = true;
      schedulerRef.current?.dispose();
      schedulerRef.current = null;
    };
  }, [session, dbReady, hasMasterKey]);

  // ─── Background Fetch (OS-level, separate from foreground scheduler) ──
  useEffect(() => {
    if (!session || !dbReady) return;

    const registerBackgroundFetch = async () => {
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
        if (!isRegistered) {
          await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
            minimumInterval: 15, // 15 minutes
          });
          console.log('[BackgroundSync] Task registered');
        }
      } catch (err) {
        if (err instanceof Error && err.message.toLowerCase().includes('background')) {
          console.warn('[BackgroundSync] Skipped (Expected in Expo Go).');
        } else {
          console.error('[BackgroundSync] Failed to register task', err);
        }
      }
    };

    registerBackgroundFetch();
  }, [session, dbReady]);

  // Show loading state while database or auth initializes
  const errorMessage = dbError;

  // If critical setup isn't done yet, just render a blank screen (no spinner).
  // The system preserves the splash screen while the app is loading, so we
  // don't need to manually inject a spinner which can block the UI.
  if (!dbReady || !initialized) {
    return (
      <View style={styles.loadingContainer}>
        {errorMessage ? (
          <Text style={styles.errorText}>Startup Error: {errorMessage}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ThemeProvider value={theme}>

        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="(drawer)" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="modal" options={{ headerShown: false, presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen name="settings" options={{ headerShown: false, presentation: 'modal', title: 'Settings' }} />
          <Stack.Screen name="Tasks/[id]/index" options={{ headerShown: true, presentation: 'modal', title: 'Edit Task' }} />
          <Stack.Screen name="Tasks/new" options={{ headerShown: true, presentation: 'modal', title: 'Edit Task' }} />
          <Stack.Screen name="Notes" options={{ headerShown: false }} />
          {/* Deep link redirect: annota://note/{id} → Notes/[id] */}
          <Stack.Screen name="note/[id]" options={{ headerShown: false, animation: 'none' }} />

        </Stack>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
      </ThemeProvider>
      <Toast config={toastConfig} />
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor: '#000', // Removed: Inherit theme background to support light/dark seamlessly
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

const toastStyles = StyleSheet.create({
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
});
