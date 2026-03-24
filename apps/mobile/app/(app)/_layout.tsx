import { useAppTheme } from '@/hooks/use-app-theme';
import { useSidebar } from '@/context/sidebar-context';
import Sidebar from '@/components/navigation/sidebar';
import RevenueCatInitializer from '@/services/RevenueCat';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { 
    interpolate, 
    runOnJS, 
    useAnimatedStyle, 
    useSharedValue, 
    withTiming,
    Easing
} from 'react-native-reanimated';

export default function AppLayout() {
  const theme = useAppTheme();
  const { isOpen, close, open } = useSidebar();
  const { width: screenWidth } = useWindowDimensions();
  const drawerWidth = Math.min(screenWidth * 0.8, 300);

  const translateX = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    const isOpening = isOpen;
    translateX.value = withTiming(isOpening ? drawerWidth : 0, {
      duration: 350,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
    overlayOpacity.value = withTiming(isOpening ? 1 : 0, { duration: 300 });
  }, [isOpen, drawerWidth]);

  const startX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onBegin((event) => {
      startX.value = event.x;
    })
    .onUpdate((event) => {
      if (!isOpen && startX.value > 50) return;
      const startPosition = isOpen ? drawerWidth : 0;
      const nextX = startPosition + event.translationX;
      translateX.value = Math.max(0, Math.min(nextX, drawerWidth + 40));
    })
    .onEnd((event) => {
      if (!isOpen && startX.value > 50) return;
      const threshold = drawerWidth / 3;
      if (isOpen) {
        if (event.translationX < -threshold || (event.velocityX < -500)) {
          translateX.value = withTiming(0, { duration: 300 });
          runOnJS(close)();
        } else {
          translateX.value = withTiming(drawerWidth, { duration: 300 });
        }
      } else {
        if (event.translationX > threshold || (event.velocityX > 500)) {
          translateX.value = withTiming(drawerWidth, { duration: 300 });
          runOnJS(open)();
        } else {
          translateX.value = withTiming(0, { duration: 300 });
        }
      }
    });

  const animatedStackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    shadowOpacity: interpolate(translateX.value, [0, drawerWidth], [0, 0.3]),
    elevation: interpolate(translateX.value, [0, drawerWidth], [0, 10]),
  }));

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* ── Sidebar ── */}
      <View
        style={[
          absoluteStyles.sidebar,
          { width: drawerWidth, backgroundColor: theme.colors.card, zIndex: 1 },
        ]}
      >
        <Sidebar onNavigate={close} />
      </View>

      {/* ── Main Stack (Top Layer) ── */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[{ flex: 1, zIndex: 2, backgroundColor: theme.colors.background }, animatedStackStyle]}>
          <RevenueCatInitializer />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" options={{ headerShown: false, animation: 'none' }} />
            <Stack.Screen name="Tasks/index" options={{ headerShown: false, animation: 'none' }} />
            <Stack.Screen name="modal" options={{ headerShown: false, presentation: 'modal', title: 'Modal' }} />
            <Stack.Screen name="settings" options={{ headerShown: false, presentation: 'modal', title: 'Settings' }} />
            <Stack.Screen name="Tasks/[id]/index" options={{ headerShown: true, presentation: 'modal', title: 'Edit Task' }} />
            <Stack.Screen name="Tasks/new" options={{ headerShown: true, presentation: 'modal', title: 'Edit Task' }} />
            <Stack.Screen name="Notes" options={{ headerShown: false, animation: 'none' }} />
            <Stack.Screen name="note/[id]" options={{ headerShown: false, animation: 'none' }} />
            <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'modal' }} />
          </Stack>

          {/* ── Overlay (dims stack content when sidebar open) ── */}
          {isOpen && (
            <Animated.View
              style={[absoluteStyles.overlay, animatedOverlayStyle]}
              pointerEvents={isOpen ? 'auto' : 'none'}
            >
              <Pressable style={StyleSheet.absoluteFill} onPress={close} />
            </Animated.View>
          )}
        </Animated.View>
      </GestureDetector>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
    </View>
  );
}

// Re-using useEffect at the top level of this file for the translation animation
// Note: We need React imported for this.
import React, { useEffect } from 'react';

const absoluteStyles = StyleSheet.create({
  sidebar: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
