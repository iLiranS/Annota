import Calendar from '@/components/calendar';
import RecentNotesList from '@/components/notes/recent-notes-list';
import NotesSearchModal from '@/components/search/notes-search-modal';
import TaskList from '@/components/tasks/task-list';
import ThemedText from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSidebar } from '@/context/sidebar-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useUserStore as useAuthStore, useNotesStore, useSettingsStore, useTasksStore, type Task } from '@annota/core';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
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
  const { editor } = useSettingsStore();


  const { colors, dark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const { height: screenHeight } = useWindowDimensions();
  const hasTriggeredGesture = useRef(false);
  const startY = useRef(0);

  const panGesture = useMemo(() =>
    Gesture.Pan()
      .enabled(!isSearchVisible)
      .onBegin((e) => {
        startY.current = e.y;
        hasTriggeredGesture.current = false;
      })
      .onUpdate((e) => {
        if (hasTriggeredGesture.current) return;

        // Check if started in the middle-ish vertical area (avoiding edges)
        const isFromCenter = startY.current > screenHeight * 0.15 && startY.current < screenHeight * 0.8;

        // Trigger search on meaningful swipe down
        if (isFromCenter && e.translationY > 60 && e.velocityY > 500) {
          hasTriggeredGesture.current = true;
          runOnJS(setIsSearchVisible)(true);
        }
      })
      .activeOffsetY(10) // Small threshold to distinguish from simple taps
      .shouldCancelWhenOutside(true),
    [isSearchVisible, screenHeight]
  );

  // Use Zustand stores
  const { tasks, loadTasks } = useTasksStore();
  const { createNote, folders } = useNotesStore();

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


  // Load tasks from database on mount
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);


  const tasksForSelectedDate = useMemo(() => {
    return tasks.filter((task) => {
      const taskDate = new Date(task.deadline);
      return (
        taskDate.getDate() === selectedDate.getDate() &&
        taskDate.getMonth() === selectedDate.getMonth() &&
        taskDate.getFullYear() === selectedDate.getFullYear()
      );
    });
  }, [selectedDate, tasks]);

  // Get next 3 upcoming tasks excluding today
  const upcomingTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return [...tasks]
      .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
      .filter((task) => {
        const taskDate = new Date(task.deadline);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate >= tomorrow && !task.completed;
      })
      .slice(0, 3);
  }, [tasks]);

  const isToday = useMemo(() => {
    const today = new Date();
    return (
      selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear()
    );
  }, [selectedDate]);

  const [activeTab, setActiveTab] = useState<'tasks' | 'notes'>('tasks');

  // Animation for tab sliding background
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [tabWidth, setTabWidth] = useState(0);

  // Handle tab container layout to get individual tab width
  const onTabContainerLayout = useCallback((event: LayoutChangeEvent) => {
    const containerWidth = event.nativeEvent.layout.width;
    // Account for container padding (4px each side) and gap (4px)
    const availableWidth = containerWidth - 8 - 4;
    setTabWidth(availableWidth / 2);
  }, []);

  // Animate slide when activeTab changes
  useEffect(() => {
    const toValue = activeTab === 'tasks' ? 0 : 1;
    Animated.spring(slideAnim, {
      toValue,
      useNativeDriver: true,
      // Jelly-like spring configuration
      tension: 68,
      friction: 10,
    }).start();
  }, [activeTab, slideAnim]);



  const formattedSelectedDate = useMemo(() => {
    if (isToday) {
      return 'Today';
    }

    return selectedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }, [isToday, selectedDate]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const handleTaskPress = useCallback((task: Task) => {
    router.push(`/Tasks/${task.id}`);
  }, [router]);

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
    <GestureDetector gesture={panGesture}>
      <ThemedView style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            headerTransparent: true,
            headerShadowVisible: false,
            headerBackground: () => (
              <BlurView
                intensity={80}
                style={StyleSheet.absoluteFill}
                tint={dark ? 'dark' : 'light'}
              />
            ),
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

        <ScrollView
          style={styles.container}
          contentContainerStyle={{
            paddingTop: insets.top + 64, // Base header height + original 20px padding
            paddingBottom: insets.bottom + 20,
          }}
        >
          {/* Calendar */}
          <View style={{ paddingHorizontal: 20 }}>
            <Calendar selectedDate={selectedDate} onDateSelect={handleDateSelect} />
          </View>

          {/* Content Section */}
          <View style={styles.contentSection}>
            {isToday ? (
              <>
                {/* Tab Switcher */}
                <View style={{ paddingHorizontal: 20 }}>
                  <View
                    style={[styles.tabContainer, { backgroundColor: colors.card }]}
                    onLayout={onTabContainerLayout}
                  >
                    <Animated.View
                      style={[
                        styles.tabIndicator,
                        {
                          backgroundColor: colors.primary + '80',
                          shadowColor: colors.primary,
                          width: tabWidth,
                          transform: [
                            {
                              translateX: slideAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, tabWidth + 4],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                    <Pressable
                      onPress={() => setActiveTab('tasks')}
                      style={styles.tab}
                    >
                      <Ionicons
                        name="checkbox-outline"
                        size={20}
                        style={[
                          styles.tabIcon,
                          { left: 12 },
                          { color: activeTab === 'tasks' ? '#FFFFFF' : colors.text },
                          { opacity: activeTab === 'tasks' ? 1 : 0.5 }
                        ]}
                      />
                      <ThemedText
                        style={[
                          styles.tabText,
                          activeTab === 'tasks' && styles.activeTabText
                        ]}
                      >
                        Tasks
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => setActiveTab('notes')}
                      style={styles.tab}
                    >
                      <ThemedText
                        style={[
                          styles.tabText,
                          activeTab === 'notes' && styles.activeTabText
                        ]}
                      >
                        Recent Notes
                      </ThemedText>
                      <Ionicons
                        name="document-text-outline"
                        size={20}
                        style={[
                          styles.tabIcon,
                          { right: 12 },
                          { color: activeTab === 'notes' ? '#FFFFFF' : colors.text },
                          { opacity: activeTab === 'notes' ? 1 : 0.5 }
                        ]}
                      />
                    </Pressable>
                  </View>
                </View>

                {activeTab === 'tasks' ? (
                  <View style={[styles.tabContentInner, { paddingHorizontal: 20 }]}>
                    <TaskList
                      tasks={tasksForSelectedDate}
                      selectedDate={selectedDate}
                      onTaskPress={handleTaskPress}
                      showComingUp={true}
                      upcomingTasks={upcomingTasks}
                      scrollEnabled={false}
                    />
                  </View>
                ) : (
                  <RecentNotesList onCreateNote={handleCreateNote} scrollEnabled={false} />
                )}
              </>
            ) : (
              <View style={[styles.tabContentInner, { paddingHorizontal: 20 }]}>
                <TaskList
                  tasks={tasksForSelectedDate}
                  selectedDate={selectedDate}
                  onTaskPress={handleTaskPress}
                  showComingUp={false}
                  scrollEnabled={false}
                />
              </View>
            )}
          </View>
        </ScrollView>

        {/* Search Modal */}
        <NotesSearchModal
          visible={isSearchVisible}
          onClose={() => setIsSearchVisible(false)}
          onFolderPress={handleFolderPress}
          onNotePress={handleNotePress}
          allFolders={folders}
        />
      </ThemedView>
    </GestureDetector>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  greetingContainer: {
    flex: 1,
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
  glassHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
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

