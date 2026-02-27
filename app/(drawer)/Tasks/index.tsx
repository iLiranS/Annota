import FloatingActionButton from '@/components/floating-action-button';
import { CollapsibleGroup, CompactTaskCard, TaskCard } from '@/components/tasks';
import ThemedText from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useNotesStore } from '@/stores/notes-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useTasksStore, type Task } from '@/stores/tasks-store';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, UIManager, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

type GroupByOption = 'none' | 'folder' | 'date';

export default function TasksScreen() {
    const router = useRouter();
    const { colors, dark } = useTheme();
    const insets = useSafeAreaInsets();

    // Stores
    const { tasks, toggleComplete, loadTasks, clearCompletedTasks } = useTasksStore();
    const { general, updateGeneralSettings } = useSettingsStore();
    const { getFolderById } = useNotesStore();
    const compactMode = general.compactMode;
    const showCompleted = general.tasksShowDone;

    // Local state
    const [groupBy, setGroupBy] = useState<GroupByOption>('none');
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    // Load tasks from database on mount
    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    const handleTaskPress = useCallback(
        (task: Task) => {
            router.push(`/Tasks/${task.id}`);
        },
        [router]
    );

    const handleToggle = useCallback(
        (taskId: string) => {
            toggleComplete(taskId);
        },
        [toggleComplete]
    );

    const toggleGroupCollapse = useCallback((groupId: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCollapsedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupId)) {
                next.delete(groupId);
            } else {
                next.add(groupId);
            }
            return next;
        });
    }, []);

    const handleClearCompleted = useCallback(() => {
        Alert.alert(
            'Clear Completed Tasks',
            'Are you sure you want to permanently delete all completed tasks?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: () => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        clearCompletedTasks();
                    },
                },
            ]
        );
    }, [clearCompletedTasks]);

    const cycleGroupBy = useCallback(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setGroupBy((prev) => {
            if (prev === 'none') return 'folder';
            if (prev === 'folder') return 'date';
            return 'none';
        });
        setCollapsedGroups(new Set()); // Reset collapsed state when changing group
    }, []);

    // Sort and group tasks
    const sortedTasks = useMemo(
        () => [...tasks].sort((a, b) => a.deadline.getTime() - b.deadline.getTime()),
        [tasks]
    );
    const pendingTasks = sortedTasks.filter((t) => !t.completed);
    const completedTasks = sortedTasks.filter((t) => t.completed);

    // Group pending tasks
    const groupedPendingTasks = useMemo(() => {
        if (groupBy === 'none') return null;

        const groups: Map<string, { title: string; color?: string; tasks: Task[] }> = new Map();

        if (groupBy === 'folder') {
            // Group by folder
            pendingTasks.forEach((task) => {
                const folder = task.folderId ? getFolderById(task.folderId) : null;
                const groupId = task.folderId || '__no_folder__';
                const groupTitle = folder ? folder.name : 'No Folder';
                const groupColor = folder?.color;

                if (!groups.has(groupId)) {
                    groups.set(groupId, { title: groupTitle, color: groupColor, tasks: [] });
                }
                groups.get(groupId)!.tasks.push(task);
            });
        } else if (groupBy === 'date') {
            // Group by date
            pendingTasks.forEach((task) => {
                const dateKey = task.deadline.toDateString();
                const now = new Date();
                const isToday = task.deadline.toDateString() === now.toDateString();
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const isTomorrow = task.deadline.toDateString() === tomorrow.toDateString();

                let displayTitle = task.deadline.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                });
                if (isToday) displayTitle = 'Today';
                if (isTomorrow) displayTitle = 'Tomorrow';

                const isOverdue = task.deadline < now;
                const groupColor = isOverdue ? '#EF4444' : isToday ? '#F59E0B' : undefined;

                if (!groups.has(dateKey)) {
                    groups.set(dateKey, { title: displayTitle, color: groupColor, tasks: [] });
                }
                groups.get(dateKey)!.tasks.push(task);
            });
        }

        return Array.from(groups.entries()).map(([id, data]) => ({ id, ...data }));
    }, [groupBy, pendingTasks, getFolderById]);

    const getGroupByLabel = () => {
        if (groupBy === 'none') return 'Group';
        if (groupBy === 'folder') return 'Folder';
        return 'Date';
    };

    const CardComponent = compactMode ? CompactTaskCard : TaskCard;

    return (
        <ThemedView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
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
                            <Ionicons name="add" size={22} color={colors.primary} />
                        </Pressable>
                    </View>
                    <ThemedText style={[styles.subtitle, { color: colors.text + '70' }]}>
                        {pendingTasks.length} pending · {completedTasks.length} done
                    </ThemedText>

                    {/* Controls Row */}
                    <View style={styles.controlsRow}>
                        {/* Group By Button */}
                        <Pressable
                            onPress={cycleGroupBy}
                            style={[
                                styles.controlButton,
                                {
                                    backgroundColor: groupBy !== 'none' ? colors.primary + '15' : dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                },
                            ]}
                        >
                            <Ionicons
                                name="layers-outline"
                                size={16}
                                color={groupBy !== 'none' ? colors.primary : colors.text + '70'}
                            />
                            <ThemedText
                                style={[
                                    styles.controlButtonText,
                                    { color: groupBy !== 'none' ? colors.primary : colors.text + '70' },
                                ]}
                            >
                                {getGroupByLabel()}
                            </ThemedText>
                        </Pressable>

                        {/* Toggle Completed */}
                        <Pressable
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                updateGeneralSettings({ tasksShowDone: !showCompleted });
                            }}
                            style={[
                                styles.controlButton,
                                {
                                    backgroundColor: showCompleted ? colors.primary + '15' : dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                },
                            ]}
                        >
                            <Ionicons
                                name={showCompleted ? 'eye' : 'eye-off'}
                                size={16}
                                color={showCompleted ? colors.primary : colors.text + '70'}
                            />
                            <ThemedText
                                style={[
                                    styles.controlButtonText,
                                    { color: showCompleted ? colors.primary : colors.text + '70' },
                                ]}
                            >
                                Done
                            </ThemedText>
                        </Pressable>
                    </View>
                </View>

                {/* Pending Tasks - Grouped or Flat */}
                {pendingTasks.length > 0 && (
                    <View style={styles.section}>
                        {groupBy === 'none' ? (
                            <>
                                <ThemedText style={styles.sectionTitle}>Upcoming</ThemedText>
                                {pendingTasks.map((task) => (
                                    <CardComponent
                                        key={task.id}
                                        task={task}
                                        onPress={() => handleTaskPress(task)}
                                        onToggle={() => handleToggle(task.id)}
                                    />
                                ))}
                            </>
                        ) : (
                            groupedPendingTasks?.map((group) => (
                                <CollapsibleGroup
                                    key={group.id}
                                    title={group.title}
                                    color={group.color}
                                    tasks={group.tasks}
                                    isCollapsed={collapsedGroups.has(group.id)}
                                    onToggleCollapse={() => toggleGroupCollapse(group.id)}
                                    onTaskPress={handleTaskPress}
                                    onTaskToggle={handleToggle}
                                    compact={compactMode}
                                />
                            ))
                        )}
                    </View>
                )}

                {/* Completed Tasks */}
                {showCompleted && completedTasks.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.completedHeader}>
                            <ThemedText style={[styles.sectionTitle, { color: colors.text + '60', marginBottom: 0 }]}>
                                Completed
                            </ThemedText>
                            <Pressable
                                onPress={handleClearCompleted}
                                style={({ pressed }) => [
                                    styles.clearButton,
                                    { opacity: pressed ? 0.6 : 1 },
                                ]}
                            >
                                <Ionicons name="trash-outline" size={12} color="#EF4444" />
                                <ThemedText style={styles.clearButtonText}>Clear</ThemedText>
                            </Pressable>
                        </View>
                        {completedTasks.map((task) => (
                            <CardComponent
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
                        <Ionicons name="checkmark-done-circle-outline" size={56} color={colors.text + '30'} />
                        <ThemedText style={[styles.emptyTitle, { color: colors.text + '60' }]}>
                            No tasks yet
                        </ThemedText>
                        <ThemedText style={[styles.emptySubtitle, { color: colors.text + '40' }]}>
                            Add your first task to get started
                        </ThemedText>
                    </View>
                )}

            </ScrollView>

            {/* Bottom Footer */}
            <View style={[
                styles.footer,
                {
                    paddingBottom: Math.max(insets.bottom, 16),
                    backgroundColor: colors.background,
                    borderTopColor: colors.border,
                }
            ]}>
                <View style={styles.footerContent}>
                    <View style={styles.footerSide} />

                    <FloatingActionButton
                        onPress={() => router.push('/Tasks/new')}
                        isFloating={false}
                        size={52}
                    />

                    <View style={styles.footerSide} />
                </View>
            </View>
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
        paddingHorizontal: 16,
        paddingBottom: 100,
    },
    header: {
        marginBottom: 20,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    addButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 30,
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 13,
        marginTop: 2,
    },
    controlsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 14,
    },
    controlButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
    },
    controlButtonText: {
        fontSize: 13,
        fontWeight: '600',
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    completedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        marginTop: 10,
    },
    clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EF444415',
        borderRadius: 4,
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    clearButtonText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#EF4444',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '600',
        marginTop: 14,
    },
    emptySubtitle: {
        fontSize: 13,
        marginTop: 4,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopWidth: 1,
        paddingTop: 12,
        paddingHorizontal: 20,
    },
    footerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    footerSide: {
        flex: 1,
        alignItems: 'flex-end',
    },
});
