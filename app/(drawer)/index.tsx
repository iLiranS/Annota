import Calendar from '@/components/calendar';
import RecentNotes from '@/components/notes/recent-notes';
import TaskItem from '@/components/task-item';
import ThemedText from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { HapticPressable } from '@/components/ui/haptic-pressable';
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

  const isToday = useMemo(() => {
    const today = new Date();
    return (
      selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear()
    );
  }, [selectedDate]);

  const [activeTab, setActiveTab] = useState<'tasks' | 'notes'>('tasks');



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

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
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
            <ThemedText style={styles.greetingText}>
              {greeting}, <ThemedText style={[styles.userName, { color: colors.primary }]}>User</ThemedText>
            </ThemedText>
          </View>
        </View>

        {/* Calendar */}
        <Calendar selectedDate={selectedDate} onDateSelect={handleDateSelect} />

        {/* Content Section */}
        {!isToday ? (
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
                      { backgroundColor: colors.primary + '20' },
                    ]}
                  >
                    <ThemedText style={[styles.taskCountText, { color: colors.primary + '90' }]}>
                      {tasksForSelectedDate.length}
                    </ThemedText>
                  </View>
                }
                <Pressable
                  onPress={() => router.push({ pathname: '/Tasks/new', params: { day: selectedDate.getDate() } })}
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
              <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="calendar-outline" size={40} color={colors.text + '25'} />
                <ThemedText style={[styles.emptyStateText, { color: colors.text + '50' }]}>
                  No tasks scheduled
                </ThemedText>
              </View>
            )}
          </View>
        ) : (
          <View style={{ marginTop: 24 }}>
            {/* Tab Switcher */}
            <View style={[styles.tabContainer, { backgroundColor: colors.card, marginBottom: 18 }]}>
              <Pressable
                onPress={() => setActiveTab('tasks')}
                style={[
                  styles.tab,
                  activeTab === 'tasks' && [styles.activeTab, { backgroundColor: colors.primary + '80', shadowColor: colors.primary + '80' }]
                ]}
              >
                <ThemedText style={[styles.tabText, activeTab === 'tasks' && styles.activeTabText]}>
                  Tasks
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setActiveTab('notes')}
                style={[
                  styles.tab,
                  activeTab === 'notes' && [styles.activeTab, { backgroundColor: colors.primary + '80', shadowColor: colors.primary + '80' }]
                ]}
              >
                <ThemedText style={[styles.tabText, activeTab === 'notes' && styles.activeTabText]}>
                  Recent Notes
                </ThemedText>
              </Pressable>
            </View>

            {/* Tab Content */}
            {activeTab === 'tasks' ? (
              <View>
                {/* Today's Tasks */}
                <View style={styles.tasksSectionHeader}>
                  <ThemedText style={styles.tasksSectionTitle}>Today's Focus</ThemedText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
                    {tasksForSelectedDate.length > 0 &&
                      <View style={[styles.taskCountBadge, { backgroundColor: colors.primary + '20' }]}>
                        <ThemedText style={[styles.taskCountText, { color: colors.primary + '90' }]}>
                          {tasksForSelectedDate.length}
                        </ThemedText>
                      </View>
                    }
                    <Pressable
                      onPress={() => router.push({ pathname: '/Tasks/new', params: { day: selectedDate.getDate() } })}
                      style={({ pressed }) => [
                        styles.addTaskButton,
                        { backgroundColor: colors.primary + '90', opacity: pressed ? 0.8 : 1 }
                      ]}
                    >
                      <Ionicons name="add" size={20} color="#FFFFFF" />
                    </Pressable>
                  </View>
                </View>

                {tasksForSelectedDate.length > 0 ? (
                  tasksForSelectedDate.map((task) => (
                    <TaskItem key={task.id} task={task} onPress={() => handleTaskPress(task)} />
                  ))
                ) : (
                  <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border, paddingVertical: 30 }]}>
                    <ThemedText style={{ color: colors.text + '50', fontWeight: '600' }}>Full focus! No tasks for today</ThemedText>
                  </View>
                )}

                {/* Upcoming Tasks Header */}
                <View style={styles.upcomingHeader}>
                  <Ionicons name="calendar-outline" size={14} color={colors.text + '40'} />
                  <ThemedText style={[styles.upcomingHeaderText, { color: colors.text + '40' }]}>
                    Coming Up
                  </ThemedText>
                </View>

                {upcomingTasks.length > 0 ? (
                  <View style={{ gap: 10 }}>
                    {upcomingTasks.map((task) => (
                      <TaskItem key={task.id} task={task} onPress={() => handleTaskPress(task)} showDate />
                    ))}
                  </View>
                ) : (
                  <View style={[styles.emptyState, { height: 80, justifyContent: 'center', borderColor: colors.border }]}>
                    <ThemedText style={{ color: colors.text + '50' }}>No upcoming tasks</ThemedText>
                  </View>
                )}
              </View>
            ) : (
              <RecentNotes />
            )}
          </View>
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
  upcomingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: 8,
  },
  upcomingHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
