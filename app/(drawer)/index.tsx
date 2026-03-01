import Calendar from '@/components/calendar';
import RecentNotesList from '@/components/notes/recent-notes-list';
import TaskList from '@/components/tasks/task-list';
import ThemedText from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { HapticPressable } from '@/components/ui/haptic-pressable';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useNotesStore } from '@/lib/stores/notes.store';
import { useSettingsStore } from '@/lib/stores/settings.store';
import { useTasksStore, type Task } from '@/lib/stores/tasks.store';
import { useUserStore as useAuthStore } from '@/lib/stores/user.store';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GUEST_DISPLAY_NAME_KEY } from '../settings/account';


export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
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
  const displayName = session ? (storeDisplayName || (displayNameFetched ? fallbackName : '...')) : guestDisplayName;
  const { editor } = useSettingsStore();


  const { colors, dark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState(new Date());

  // Use Zustand stores
  const { tasks, loadTasks } = useTasksStore();
  const { createNote } = useNotesStore();

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
    const newNote = await createNote({});
    router.push({ pathname: '/Notes/[id]', params: { id: newNote.id, source: 'new' } });
  }, [createNote, router]);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 10 }]}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: 20 }]}>
        <HapticPressable
          onPress={() => navigation.openDrawer()}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            padding: 4,
            marginLeft: -4,
          })}
        >
          <Ionicons name="menu-outline" size={28} color={colors.text} />
        </HapticPressable>
        <View style={styles.greetingContainer}>
          <ThemedText style={[styles.greetingText, { fontFamily: editor.fontFamily }]}>
            {greeting}, <ThemedText style={[styles.userName, { color: colors.primary }]}>{displayName}</ThemedText>
          </ThemedText>
        </View>
      </View>

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
                />
              </View>
            ) : (
              <RecentNotesList onCreateNote={handleCreateNote} />
            )}
          </>
        ) : (
          <View style={[styles.tabContentInner, { paddingHorizontal: 20 }]}>
            <TaskList
              tasks={tasksForSelectedDate}
              selectedDate={selectedDate}
              onTaskPress={handleTaskPress}
              showComingUp={false}
            />
          </View>
        )}
      </View>

      {/* Bottom Spacing */}
      <View style={{ height: insets.bottom + 20 }} />
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
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  userName: {
    fontWeight: '700',
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
