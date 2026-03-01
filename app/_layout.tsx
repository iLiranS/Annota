
import { ThemeProvider } from '@react-navigation/native';
import * as BackgroundTask from 'expo-background-task';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import * as TaskManager from 'expo-task-manager';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, InteractionManager, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import Toast, { type ToastConfig, type ToastConfigParams } from 'react-native-toast-message';

const BACKGROUND_SYNC_TASK = 'BACKGROUND_SYNC_TASK';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const { authApi } = require('@/lib/api/auth.api');
    const { syncPull, syncPush } = require('@/lib/sync/sync-service');
    const { getMasterKey } = require('@/lib/utils/crypto');

    const { data: { session } } = await authApi.getSession();
    if (!session) return BackgroundTask.BackgroundTaskResult.Success;

    const key = await getMasterKey(session.user.id);
    if (!key) return BackgroundTask.BackgroundTaskResult.Success;

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
import { authApi } from '@/lib/api/auth.api';
import { useDbStore } from '@/lib/stores/db.store';
import { useUserStore as useAuthStore } from '@/lib/stores/user.store';
import { SyncScheduler } from '@/lib/sync/sync-scheduler';
import { getMasterKey } from '@/lib/utils/crypto';

export const unstable_settings = {
  anchor: '(drawer)',
};

// ─── Custom Toast Config ────────────────────────────────────
const RETRY_COOLDOWN_MS = 10_000;

function OfflineToast({ text1, text2, hide }: ToastConfigParams<any>) {
  const [cooldown, setCooldown] = useState(false);

  const handleRetry = useCallback(() => {
    if (cooldown) return;
    setCooldown(true);
    SyncScheduler.instance?.requestImmediateSync();
    setTimeout(() => setCooldown(false), RETRY_COOLDOWN_MS);
    hide();
  }, [cooldown, hide]);

  return (
    <View style={toastStyles.container}>
      <View style={toastStyles.textWrap}>
        <Text style={toastStyles.title}>{text1}</Text>
        {text2 ? <Text style={toastStyles.subtitle}>{text2}</Text> : null}
      </View>
      <Pressable
        onPress={handleRetry}
        disabled={cooldown}
        style={[toastStyles.retryBtn, cooldown && toastStyles.retryBtnDisabled]}
      >
        <Text style={toastStyles.retryText}>{cooldown ? 'Wait…' : 'Retry'}</Text>
      </Pressable>
    </View>
  );
}

const toastConfig: ToastConfig = {
  offlineToast: (props: any) => <OfflineToast {...props} />,
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

    try {
      if (user) {
        checkMasterKey();
        initDB(user.id);
      } else {
        // Fallback to guest DB for unauthenticated users (so the app can render the Auth screen)
        // Without this, dbReady stays false forever.
        initDB(null);
      }
    } catch (e) {
      setDbError(e instanceof Error ? e.message : 'Unknown error');
    }
  }, [initialized, user?.id]);

  useEffect(() => {
    if (dbReady) {
      // Initialize store (load all data into memory)
      const { useNotesStore } = require('@/lib/stores/notes.store');
      const { useTasksStore } = require('@/lib/stores/tasks.store');
      useNotesStore.getState().initApp();
      useTasksStore.getState().loadTasks();



    }
  }, [dbReady, user?.id, isGuest]);

  useEffect(() => {
    let isMounted = true;

    // Add a timeout to prevent infinite spinning when offline
    Promise.race([
      authApi.getSession(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Session fetch timeout')), 8000))
    ])
      .then((result: any) => {
        if (isMounted && result?.data?.session) {
          setSession(result.data.session);
        } else if (isMounted) {
          // Even if session is null, we must initialize to dismiss the spinner
          useAuthStore.setState({ initialized: true });
        }
      })
      .catch((error) => {
        console.warn('[RootLayout] Auth getSession failed or timed out:', error);
        if (isMounted) {
          // Force initialization on network error so the user doesn't stay trapped on the loading screen.
          useAuthStore.setState({ initialized: true });
        }
      });

    const subscription = authApi.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setSession(session);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!initialized || !dbReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !isGuest) {
      // User is not authenticated nor a guest
      if (!inAuthGroup) {
        if (router.canDismiss()) {
          router.dismissAll();
        } else {
          router.replace('/(auth)');
        }
      }
    } else if (session) {
      // User is authenticated
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

      const scheduler = new SyncScheduler();
      schedulerRef.current = scheduler;
      scheduler.init(key);
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

  if (!dbReady || !initialized || (session && hasMasterKey === null)) {
    return (
      <View style={styles.loadingContainer}>
        {errorMessage ? (
          <Text style={styles.errorText}>Startup Error: {errorMessage}</Text>
        ) : (
          <ActivityIndicator size="large" />
        )}
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
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
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
  retryBtn: {
    backgroundColor: 'rgba(99,102,241,0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnDisabled: {
    opacity: 0.4,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
