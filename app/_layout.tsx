
import { ThemeProvider } from '@react-navigation/native';
import * as BackgroundFetch from 'expo-background-fetch';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import * as TaskManager from 'expo-task-manager';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

const BACKGROUND_SYNC_TASK = 'BACKGROUND_SYNC_TASK';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const { supabase } = require('@/lib/supabase');
    const { syncPull, syncPush } = require('@/lib/sync/sync-service');
    const { getMasterKey } = require('@/lib/utils/crypto');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return BackgroundFetch.BackgroundFetchResult.NoData;

    const key = await getMasterKey();
    if (!key) return BackgroundFetch.BackgroundFetchResult.NoData;

    // Note: For background fetch, doing heavy operations must be well bounded
    await syncPull(key);
    await syncPush(key);

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error("[BackgroundSync] Failed:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

import { useAppTheme } from '@/hooks/use-app-theme'; // USe our new hook
import { supabase } from '@/lib/supabase';
import { syncPull, syncPush } from '@/lib/sync/sync-service';
import { getMasterKey } from '@/lib/utils/crypto';
import { useAuthStore } from '@/stores/auth-store';
import { useDbStore } from '@/stores/db-store';

export const unstable_settings = {
  anchor: '(drawer)',
};

export default function RootLayout() {
  const theme = useAppTheme(); // Get the calculated theme
  const { initialized, session, user, isGuest, setSession } = useAuthStore();
  const dbReady = useDbStore(state => state.isReady);
  const initDB = useDbStore(state => state.initDB);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.background);
  }, [theme.colors.background]);

  useEffect(() => {
    if (!initialized) return;

    try {
      if (user) {
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
      const { useNotesStore } = require('@/stores/notes-store');
      const { useTasksStore } = require('@/stores/tasks-store');
      useNotesStore.getState().initApp();
      useTasksStore.getState().loadTasks();
    }
  }, [dbReady, user?.id, isGuest]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
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
      if (inAuthGroup && segments[1] !== 'master-key') {
        // If they are on the login screen, redirect to drawer.
        // We don't redirect if they are on master-key, as they might need to set it up.
        router.replace('/(drawer)');
      }
    } else if (isGuest) {
      // User is a guest
      if (inAuthGroup) {
        router.replace('/(drawer)');
      }
    }
  }, [session, isGuest, initialized, dbReady, segments]);

  // Sync Loop
  useEffect(() => {


    async function doSync() {
      if (!session) return;
      const key = await getMasterKey();
      if (!key) return; // Wait for them to onboard

      try {
        // Pull changes from cloud
        await syncPull(key);

        // Push local dirty changes to cloud
        await syncPush(key);

        // Force a heavy re-init of stores so the UI repaints with the newly pulled data
        // In a production app, we'd emit an event or merge specifically, but this is okay for V1
        const { useNotesStore } = require('@/stores/notes-store');
        const { useTasksStore } = require('@/stores/tasks-store');
        useNotesStore.getState().initApp();
        useTasksStore.getState().loadTasks();
      } catch (err) {
        console.error("Sync Error:", err);
      }
    }

    if (session && dbReady) {
      // Sync immediately on mount/auth
      doSync();
      // Then every 60 seconds (Commented out for now as requested by user)
      // intervalId = setInterval(doSync, 60000);
    }

    // Register Background Fetch
    const registerBackgroundFetch = async () => {
      if (!session) return;
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
        if (!isRegistered) {
          await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
            minimumInterval: 15 * 60, // 15 minutes
            stopOnTerminate: false,
            startOnBoot: true,
          });
          console.log("[BackgroundSync] Task registered");
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('Background Fetch has not been configured')) {
          console.warn("[BackgroundSync] Skipped background fetch registration (Expected in Expo Go).");
        } else {
          console.error("[BackgroundSync] Failed to register task", err);
        }
      }
    };

    if (session && dbReady) {
      registerBackgroundFetch();
    }

    return () => {
      // if (intervalId) clearInterval(intervalId);
    };
  }, [session, dbReady]);

  // Show loading state while database or auth initializes
  const errorMessage = dbError;

  if (!dbReady || !initialized) {
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

        </Stack>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
      </ThemeProvider>
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
