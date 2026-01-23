import Calendar from '@/components/calendar';
import RecentNotes from '@/components/notes/recent-notes';
import TaskItem from '@/components/task-item';
import ThemedText from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTasksStore, type Task } from '@/stores/tasks-store';
import { Ionicons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation<DrawerNavigationProp<any>>();

  const { colors, dark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState(new Date());

  // Use Zustand store for tasks
  const { tasks, loadTasks } = useTasksStore();


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

  const [activeTab, setActiveTab] = useState<'notes' | 'later'>('later');



  const formattedSelectedDate = useMemo(() => {
    const today = new Date();
    const isToday =
      selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear();

    if (isToday) {
      return 'Today';
    }

    return selectedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }, [selectedDate]);

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

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.openDrawer()}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              padding: 4,
              marginLeft: -4,
            })}
          >
            <Ionicons name="menu-outline" size={28} color={colors.text} />
          </Pressable>
          <View style={styles.greetingContainer}>
            <ThemedText style={styles.greetingText}>
              {greeting}, <ThemedText style={[styles.userName, { color: colors.primary }]}>User</ThemedText>
            </ThemedText>
          </View>
        </View>

        {/* Calendar */}
        <Calendar selectedDate={selectedDate} onDateSelect={handleDateSelect} />

        {/* Tasks Section */}
        <View style={styles.tasksSection}>
          <View style={styles.tasksSectionHeader}>
            <ThemedText style={styles.tasksSectionTitle}>
              Tasks for {formattedSelectedDate}
            </ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
              {tasksForSelectedDate.length > 0 &&
                <View
                  style={[
                    styles.taskCountBadge,
                    { backgroundColor: tasksForSelectedDate.length > 0 ? colors.primary + '20' : colors.text + '10' },
                  ]}
                >

                  <ThemedText
                    style={[
                      styles.taskCountText,
                      { color: tasksForSelectedDate.length > 0 ? colors.primary + '90' : colors.text + '50' },
                    ]}
                  >
                    {tasksForSelectedDate.length}
                  </ThemedText>
                </View>
              }
              {formattedSelectedDate === 'Today' && (
                <Pressable
                  onPress={() => router.push('/Tasks/new')}
                  style={({ pressed }) => [
                    styles.addTaskButton,
                    {
                      backgroundColor: colors.primary + '90',
                      opacity: pressed ? 0.8 : 1,
                    }
                  ]}
                  hitSlop={8}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </Pressable>
              )}
            </View>
          </View>

          {tasksForSelectedDate.length > 0 ? (
            tasksForSelectedDate.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onPress={() => handleTaskPress(task)}
              />
            ))
          ) : (
            <View
              style={[
                styles.emptyState,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="calendar-outline" size={40} color={colors.text + '25'} />
              <ThemedText style={[styles.emptyStateText, { color: colors.text + '50' }]}>
                No tasks scheduled
              </ThemedText>
              <ThemedText style={[styles.emptyStateSubtext, { color: colors.text + '35' }]}>
                Tap a date with a dot to see tasks
              </ThemedText>
            </View>
          )}
        </View>

        {formattedSelectedDate === 'Today' && (
          <>
            {/* Tab Switcher */}
            <View style={[
              styles.tabContainer,
              { backgroundColor: colors.card }
            ]}>
              <Pressable
                onPress={() => setActiveTab('later')}
                style={[
                  styles.tab,
                  activeTab === 'later' && [styles.activeTab, { backgroundColor: colors.primary + '80', shadowColor: colors.primary + '80' }],
                ]}
              >
                <ThemedText style={[
                  styles.tabText,
                  activeTab === 'later' && styles.activeTabText
                ]}>
                  Later On
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setActiveTab('notes')}
                style={[
                  styles.tab,
                  activeTab === 'notes' && [styles.activeTab, { backgroundColor: colors.primary + '80', shadowColor: colors.primary + '80' }]
                ]}
              >
                <ThemedText style={[
                  styles.tabText,
                  activeTab === 'notes' && styles.activeTabText
                ]}>
                  Recent Notes
                </ThemedText>
              </Pressable>
            </View>

            {/* Tab Content */}
            <View style={styles.tabContent}>
              {activeTab === 'notes' ? (
                <RecentNotes />
              ) : (
                <View>
                  <ThemedText style={styles.sectionTitle}>Future Tasks</ThemedText>
                  <View style={{ height: 16 }} />
                  {upcomingTasks.length > 0 ? (
                    <View style={{ gap: 10 }}>
                      {upcomingTasks.map((task) => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          onPress={() => handleTaskPress(task)}
                          showDate
                        />
                      ))}
                    </View>
                  ) : (
                    <View style={[styles.emptyState, { height: 120, justifyContent: 'center' }]}>
                      <ThemedText style={{ color: colors.text + '50' }}>No upcoming tasks</ThemedText>
                    </View>
                  )}
                </View>
              )}
            </View>
          </>
        )}

        {/* Bottom Spacing */}
        <View style={{ height: insets.bottom + 100 }} />
      </ScrollView>
    </ThemedView>

  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
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
  tasksSection: {
    marginTop: 28,
  },
  tasksSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    minHeight: 28,
  },
  tasksSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,

  },
  taskCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  taskCountText: {
    fontSize: 13,
    fontWeight: '700',
  },
  addTaskButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    borderRadius: 16,
    borderWidth: 1,
  },
  emptyStateText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 13,
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    marginTop: 32,
    marginBottom: 20,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTab: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
  tabContent: {
    minHeight: 200,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

});
