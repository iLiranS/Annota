
import { ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useAppTheme } from '@/hooks/use-app-theme'; // USe our new hook
import { initDatabase } from '@/lib/db/client';
import { supabase } from '@/lib/supabase';
import { syncPull, syncPush } from '@/lib/sync/sync-service';
import { getMasterKey } from '@/lib/utils/crypto';
import { useAuthStore } from '@/stores/auth-store';

export const unstable_settings = {
  anchor: '(drawer)',
};

export default function RootLayout() {
  const theme = useAppTheme(); // Get the calculated theme
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.background);
  }, [theme.colors.background]);

  useEffect(() => {
    async function setupApp() {
      try {
        initDatabase();
        // await resetAll(); // TODO: Comment this out after first run to stop resetting DB

        // Initialize store (load all data into memory)
        const { useNotesStore } = require('@/stores/notes-store');
        useNotesStore.getState().initApp();

        setDbReady(true);
      } catch (error) {
        console.error('Database initialization failed:', error);
        setDbError(error instanceof Error ? error.message : 'Unknown error');
      }
    }
    setupApp();
  }, []);

  const { initialized, session, isGuest, setSession } = useAuthStore();

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
        router.replace('/(auth)');
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
    let intervalId: ReturnType<typeof setInterval>;

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
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
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
