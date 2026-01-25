import ThemedText from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useNotesStore } from '@/stores/notes-store';
import { useTasksStore, type Task } from '@/stores/tasks-store';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TaskCardProps {
    task: Task;
    onToggle: () => void;
    onPress: () => void;
}

function TaskCard({ task, onToggle, onPress }: TaskCardProps) {
    const { colors, dark } = useTheme();
    const { getFolderById } = useNotesStore();
    const linkedFolder = task.folderId ? getFolderById(task.folderId) : null;

    const now = new Date();
    const isOverdue = task.deadline < now && !task.completed;
    const isToday =
        task.deadline.getDate() === now.getDate() &&
        task.deadline.getMonth() === now.getMonth() &&
        task.deadline.getFullYear() === now.getFullYear();

    const deadlineColor = isOverdue ? '#EF4444' : isToday ? '#F59E0B' : colors.text + '80';

    const formatDeadline = (date: Date): string => {
        const options: Intl.DateTimeFormatOptions = {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        };
        return date.toLocaleDateString('en-US', options);
    };

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.taskCard,
                {
                    backgroundColor: dark ? 'rgba(255,255,255,0.04)' : colors.card,
                    borderColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                    opacity: task.completed ? 0.6 : pressed ? 0.9 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                },
            ]}
        >
            {/* Checkbox */}
            <Pressable onPress={onToggle} style={styles.checkbox} hitSlop={8}>
                <View
                    style={[
                        styles.checkboxInner,
                        {
                            backgroundColor: task.completed ? '#10B981' : 'transparent',
                            borderColor: task.completed ? '#10B981' : colors.text + '40',
                        },
                    ]}
                >
                    {task.completed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
            </Pressable>

            {/* Content */}
            <View style={styles.taskContent}>
                <ThemedText
                    style={[
                        styles.taskTitle,
                        task.completed && { textDecorationLine: 'line-through', opacity: 0.7 },
                    ]}
                    numberOfLines={1}
                >
                    {task.title}
                </ThemedText>
                <ThemedText style={[styles.taskDescription, { color: colors.text + '70' }]} numberOfLines={1}>
                    {task.description}
                </ThemedText>

                <View style={styles.taskMeta}>
                    <View style={styles.deadlineBadge}>
                        <Ionicons name="time-outline" size={12} color={deadlineColor} />
                        <ThemedText style={[styles.deadlineText, { color: deadlineColor }]}>
                            {formatDeadline(task.deadline)}
                        </ThemedText>
                    </View>

                    {linkedFolder && (
                        <View style={[styles.linkedNoteBadge, { backgroundColor: linkedFolder.color + '20' }]}>
                            <Ionicons name="folder" size={10} color={linkedFolder.color || colors.primary} />
                            <ThemedText style={[styles.linkedNoteText, { color: linkedFolder.color || colors.primary }]}>
                                {linkedFolder.name}
                            </ThemedText>
                        </View>
                    )}
                </View>
            </View>

            {/* Chevron */}
            <Ionicons name="chevron-forward" size={18} color={colors.text + '40'} />
        </Pressable>
    );
}

export default function TasksScreen() {
    const router = useRouter();
    const { colors, dark } = useTheme();
    const insets = useSafeAreaInsets();

    // Use Zustand store for tasks
    const { tasks, toggleComplete, loadTasks } = useTasksStore();

    // Load tasks from database on mount
    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    const handleTaskPress = useCallback((task: Task) => {
        router.push(`/Tasks/${task.id}`);
    }, [router]);

    const handleToggle = useCallback((taskId: string) => {
        toggleComplete(taskId);
    }, [toggleComplete]);

    // Sort and group tasks
    const sortedTasks = useMemo(
        () => [...tasks].sort((a, b) => a.deadline.getTime() - b.deadline.getTime()),
        [tasks]
    );
    const pendingTasks = sortedTasks.filter((t) => !t.completed);
    const completedTasks = sortedTasks.filter((t) => t.completed);

    return (
        <ThemedView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerRow}>
                        <ThemedText style={styles.title}>Tasks</ThemedText>
                        <Pressable
                            onPress={() => router.push('/Tasks/new')}
                            style={({ pressed }) => [
                                styles.addButton,
                                {
                                    backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                                    opacity: pressed ? 0.7 : 1,
                                },
                            ]}
                            hitSlop={8}
                        >
                            <Ionicons name="add" size={24} color={colors.primary} />
                        </Pressable>
                    </View>
                    <ThemedText style={[styles.subtitle, { color: colors.text + '70' }]}>
                        {pendingTasks.length} pending · {completedTasks.length} done
                    </ThemedText>
                </View>

                {/* Pending Tasks */}
                {pendingTasks.length > 0 && (
                    <View style={styles.section}>
                        <ThemedText style={styles.sectionTitle}>Upcoming</ThemedText>
                        {pendingTasks.map((task) => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                onPress={() => handleTaskPress(task)}
                                onToggle={() => handleToggle(task.id)}
                            />
                        ))}
                    </View>
                )}

                {/* Completed Tasks */}
                {completedTasks.length > 0 && (
                    <View style={styles.section}>
                        <ThemedText style={[styles.sectionTitle, { color: colors.text + '60' }]}>
                            Completed
                        </ThemedText>
                        {completedTasks.map((task) => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                onPress={() => handleTaskPress(task)}
                                onToggle={() => handleToggle(task.id)}
                            />
                        ))}
                    </View>
                )}

                {/* Empty State */}
                {tasks.length === 0 && (
                    <View style={styles.emptyState}>
                        <Ionicons name="checkmark-done-circle-outline" size={64} color={colors.text + '30'} />
                        <ThemedText style={[styles.emptyTitle, { color: colors.text + '60' }]}>
                            No tasks yet
                        </ThemedText>
                        <ThemedText style={[styles.emptySubtitle, { color: colors.text + '40' }]}>
                            Add your first task to get started
                        </ThemedText>
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
        marginBottom: 28,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 14,
        marginTop: 4,
    },
    section: {
        marginBottom: 28,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    taskCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 10,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },
    checkbox: {
        marginRight: 14,
    },
    checkboxInner: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    taskContent: {
        flex: 1,
    },
    taskTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    taskDescription: {
        fontSize: 13,
        marginBottom: 8,
    },
    taskMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
    },
    deadlineBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    deadlineText: {
        fontSize: 11,
        fontWeight: '500',
    },
    linkedNoteBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    linkedNoteText: {
        fontSize: 10,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        marginTop: 4,
    },
});
