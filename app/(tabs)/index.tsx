import Calendar from '@/components/calendar';
import TaskItem from '@/components/task-item';
import ThemedText from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useTasksStore, type Task } from '@/stores/tasks-store';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const theme = useColorScheme() ?? 'light';
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(true);

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
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Calendar */}
        <Calendar selectedDate={selectedDate} onDateSelect={handleDateSelect} />

        {/* Tasks Section */}
        <View style={styles.tasksSection}>
          <View style={styles.tasksSectionHeader}>
            <ThemedText style={styles.tasksSectionTitle}>
              Tasks for {formattedSelectedDate}
            </ThemedText>
            {tasksForSelectedDate.length > 0 &&
              <View
                style={[
                  styles.taskCountBadge,
                  { backgroundColor: tasksForSelectedDate.length > 0 ? '#6366F1' + '20' : colors.text + '10' },
                ]}
              >

                <ThemedText
                  style={[
                    styles.taskCountText,
                    { color: tasksForSelectedDate.length > 0 ? '#6366F1' : colors.text + '50' },
                  ]}
                >
                  {tasksForSelectedDate.length}
                </ThemedText>
              </View>
            }
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
                  backgroundColor: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
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

        {formattedSelectedDate === 'Today' && upcomingTasks.length > 0 && (
          <View style={{ marginTop: 12, gap: 12 }}>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} onPress={() => setIsCollapsibleOpen((value) => !value)}>
              <ThemedText style={styles.tasksSectionTitle}>Later On</ThemedText>
              <IconSymbol
                name="chevron.down"
                size={18}
                weight="medium"
                color={theme === 'light' ? Colors.light.icon : Colors.dark.icon}
                style={{ transform: [{ rotate: isCollapsibleOpen ? '0deg' : '-90deg' }] }}
              />
            </Pressable>
            {isCollapsibleOpen && <View>
              {upcomingTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onPress={() => handleTaskPress(task)}
                  showDate
                />
              ))}
            </View>}
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
  tasksSection: {
    marginTop: 28,
  },
  tasksSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
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
});
