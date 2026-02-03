
import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useAppTheme } from '@/hooks/use-app-theme'; // USe our new hook
import { initDatabase } from '@/lib/db/client';

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
    try {
      initDatabase();
      // resetDatabase(); // TODO: Comment this out after first run to stop resetting DB

      // Initialize store (load all data into memory)
      const { useNotesStore } = require('@/stores/notes-store');
      useNotesStore.getState().initApp();

      setDbReady(true);
    } catch (error) {
      console.error('Database initialization failed:', error);
      setDbError(error instanceof Error ? error.message : 'Unknown error');
    }
  }, []);

  // Show loading state while database initializes
  const errorMessage = dbError;

  if (!dbReady) {
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
