import RecentNotesList from '@/components/notes/recent-notes-list';
import NotesSearchModal from '@/components/search/notes-search-modal';
import ThemedText from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSidebar } from '@/context/sidebar-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useUserStore as useAuthStore, useNotesStore, useSettingsStore, useSyncStore } from '@annota/core';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated as RNAnimated, LayoutChangeEvent, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { GUEST_DISPLAY_NAME_KEY } from './settings/account';


export default function HomeScreen() {
  const router = useRouter();
  const { toggle } = useSidebar();
  const { session } = useAuthStore();
  const [guestDisplayName, setGuestDisplayName] = useState('Guest');
  const [storeDisplayName, setStoreDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      const fetchName = async () => {
        const name = await useAuthStore.getState().getDisplayName();
        setStoreDisplayName(name);
      };
      fetchName();
    } else {
      setStoreDisplayName(null);
    }
  }, [session]);

  const globalDisplayName = useAuthStore(state => state.displayName);
  const displayNameFetched = useAuthStore(state => state.displayNameFetched);
  useEffect(() => {
    if (globalDisplayName !== undefined && globalDisplayName !== null) {
      setStoreDisplayName(globalDisplayName);
    }
  }, [globalDisplayName]);

  const fallbackName = session?.user?.user_metadata?.display_name || session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.user_metadata?.preferred_username || guestDisplayName;
  // Use storeDisplayName (from cache or fetched), then fallback to metadata, and only show '...' if all else fails
  const displayName = session ? (storeDisplayName || fallbackName || '...') : guestDisplayName;
  const { createNote, folders } = useNotesStore();
  const { editor } = useSettingsStore();

  const { colors, dark } = useAppTheme();
  const insets = useSafeAreaInsets();

  // Guest display name
  useEffect(() => {
    if (session) return;

    const loadGuestDisplayName = async () => {
      const value = await AsyncStorage.getItem(GUEST_DISPLAY_NAME_KEY);
      if (value) {
        setGuestDisplayName(value);
      }
    };
    loadGuestDisplayName();
  }, [session]);


  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const { height: screenHeight } = useWindowDimensions();
  const isSyncing = useSyncStore(state => state.isSyncing);
  const scrollY = useSharedValue(0);

  const triggerSync = useCallback(async () => {
    try {
      await useSyncStore.getState().forceSync();
    } catch (e) {
      console.error('[Manual Sync]', e);
    }
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
    onEndDrag: (event) => {
      if (event.contentOffset.y < -80) {
        runOnJS(triggerSync)();
      }
    },
  });

  const syncIndicatorStyle = useAnimatedStyle(() => {
    const threshold = -80;
    const pullProgress = interpolate(
      scrollY.value,
      [threshold, 0],
      [1, 0],
      Extrapolation.CLAMP
    );

    return {
      position: 'absolute',
      top: Platform.OS === 'ios' ? insets.top + 44 : insets.top + 56,
      left: 0,
      right: 0,
      width: isSyncing ? '100%' : `${pullProgress * 100}%`,
      height: 2,
      backgroundColor: colors.primary,
      opacity: isSyncing ? withTiming(1) : (pullProgress > 0 ? 1 : 0),
      zIndex: 1000,
    };
  });


  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []);



  const handleCreateNote = useCallback(async () => {
    const { data: newNote, error } = await createNote({});
    if (error) {
      Toast.show({
        type: 'error',
        text1: 'Failed to create note',
        text2: error
      });
      return;
    }
    if (newNote) {
      router.push({ pathname: '/Notes/[id]', params: { id: newNote.id, source: 'new' } });
    }
  }, [createNote, router]);

  const handleFolderPress = useCallback((folderId: string) => {
    router.push({ pathname: '/Notes', params: { folderId } });
  }, [router]);

  const handleNotePress = useCallback((noteId: string) => {
    router.push({ pathname: '/Notes/[id]', params: { id: noteId } });
  }, [router]);

  return (
    <ThemedView style={styles.container}>
      <Animated.View style={syncIndicatorStyle} />
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: 'transparent' },
          headerTitle: () => (
            <View style={styles.headerTitleContainer}>
              <ThemedText style={[styles.greetingText, { fontFamily: editor.fontFamily }]}>
                {greeting}, <ThemedText style={[styles.userName, { color: colors.primary }]}>{displayName}</ThemedText>
              </ThemedText>
            </View>
          ),
          headerLeft: () => (
            <Pressable
              onPress={toggle}
              hitSlop={8}
              style={styles.headerButton}
            >
              <Ionicons name="menu-outline" size={24} color={colors.primary} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={() => setIsSearchVisible(true)}
              hitSlop={8}
              style={styles.headerButton}
            >
              <Ionicons name="search" size={24} color={colors.primary} />
            </Pressable>
          ),
        }}
      />

      <Animated.ScrollView
        style={styles.container}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: insets.top + 64, // Base header height + original 20px padding
          paddingBottom: insets.bottom + 20,
        }}
      >

        {/* Content Section */}
        <View style={styles.contentSection}>
          <RecentNotesList onCreateNote={handleCreateNote} scrollEnabled={false} />
        </View>
      </Animated.ScrollView>

      {/* Search Modal */}
      <NotesSearchModal
        visible={isSearchVisible}
        onClose={() => setIsSearchVisible(false)}
        onFolderPress={handleFolderPress}
        onNotePress={handleNotePress}
        allFolders={folders}
      />
    </ThemedView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentSection: {
    flex: 1,
    marginTop: 20,
  },
  greetingText: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  userName: {
    fontWeight: '700',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    gap: 4,
    marginBottom: 16,
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    position: 'relative',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.5,
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '700',
    opacity: 1,
  },
  tabIcon: {
    position: 'absolute',
  },
  tabContentInner: {
    flex: 1,
  },
});

