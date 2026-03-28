import FloatingActionButton from '@/components/floating-action-button';
import { CollapsibleGroup, CompactTaskCard } from '@/components/tasks';
import ThemedText from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSidebar } from '@/context/sidebar-context';
import { useNotesStore, useSettingsStore, useSyncStore, useTasksStore, type Task } from '@annota/core';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
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

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

type GroupByOption = 'folder' | 'date';

export default function TasksScreen() {
    const router = useRouter();
    const { colors, dark } = useTheme();
    const insets = useSafeAreaInsets();

    // Stores
    const { tasks, toggleComplete, loadTasks, clearCompletedTasks } = useTasksStore();
    const { general, updateGeneralSettings } = useSettingsStore();
    const { getFolderById, notes } = useNotesStore();
    const showCompleted = general.tasksShowDone;

    // Local state
    const [groupBy, setGroupBy] = useState<GroupByOption>('date');
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const { toggle } = useSidebar();

    // Sync progress tracking
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
        setGroupBy((prev) => (prev === 'folder' ? 'date' : 'folder'));
        setCollapsedGroups(new Set()); // Reset collapsed state when changing group
    }, []);

    // Sort and group tasks
    const sortedTasks = useMemo(
        () => [...tasks].sort((a, b) => a.deadline.getTime() - b.deadline.getTime()),
        [tasks]
    );
    const pendingTasks = sortedTasks.filter((t) => !t.completed);
    const completedTasks = sortedTasks.filter((t) => t.completed);

    // Group tasks
    const groupedTasks = useMemo(() => {

        const groups: Map<string, { title: string; color?: string; icon?: string; tasks: Task[]; isFolder?: boolean }> = new Map();

        if (groupBy === 'folder') {
            // Group by folder
            const processTask = (task: Task) => {
                const groupId = task.folderId || '__no_folder__';

                if (!groups.has(groupId)) {
                    const folder = task.folderId ? getFolderById(task.folderId) : null;
                    const groupTitle = folder ? folder.name : 'No Folder';
                    const groupIcon = folder ? folder.icon : 'folder-outline';
                    const groupColor = folder?.color;

                    groups.set(groupId, {
                        title: groupTitle,
                        color: groupColor,
                        icon: groupIcon,
                        tasks: [],
                        isFolder: !!task.folderId
                    });
                }
                groups.get(groupId)!.tasks.push(task);
            };

            pendingTasks.forEach(processTask);
            if (showCompleted) {
                completedTasks.forEach(processTask);
            }
        } else if (groupBy === 'date') {
            // Group by date (pending only)
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const tomorrowStart = new Date(todayStart);
            tomorrowStart.setDate(tomorrowStart.getDate() + 1);
            const dayAfterTomorrowStart = new Date(tomorrowStart);
            dayAfterTomorrowStart.setDate(dayAfterTomorrowStart.getDate() + 1);

            pendingTasks.forEach((task) => {
                let groupId: string;
                let groupTitle: string;
                let groupColor: string | undefined;
                let groupIcon: string | undefined;

                if (task.deadline < now) {
                    groupId = 'past';
                    groupTitle = 'Past';
                    groupColor = '#EF4444';
                    groupIcon = 'alert-circle-outline';
                } else if (task.deadline < tomorrowStart) {
                    groupId = 'today';
                    groupTitle = 'Today';
                    groupColor = '#3b82f6';
                    groupIcon = 'today-outline';
                } else if (task.deadline < dayAfterTomorrowStart) {
                    groupId = 'tomorrow';
                    groupTitle = 'Tomorrow';
                    groupColor = '#8b5cf6';
                    groupIcon = 'calendar-outline';
                } else {
                    groupId = 'upcoming';
                    groupTitle = 'Upcoming';
                    groupColor = '#10b981';
                    groupIcon = 'calendar-number-outline';
                }

                if (!groups.has(groupId)) {
                    groups.set(groupId, { title: groupTitle, color: groupColor, tasks: [], icon: groupIcon });
                }
                groups.get(groupId)!.tasks.push(task);
            });
        }

        let result = Array.from(groups.entries()).map(([id, data]) => ({ id, ...data }));

        if (groupBy === 'folder') {
            const noFolderGroup = result.find(g => g.id === '__no_folder__');
            if (noFolderGroup) {
                result = result.filter(g => g.id !== '__no_folder__');
                result.push(noFolderGroup);
            }
        }

        return result;
    }, [groupBy, pendingTasks, completedTasks, showCompleted, getFolderById]);

    const getGroupByLabel = () => {
        return groupBy === 'folder' ? 'Folder' : 'Date';
    };

    const CardComponent = CompactTaskCard;

    return (
        <ThemedView style={styles.container}>
            <Animated.View style={syncIndicatorStyle} />
            <Stack.Screen
                options={{
                    title: 'Tasks',
                    headerShown: true,
                    headerTransparent: true,
                    headerTitleStyle: {
                        fontSize: 22,
                        fontWeight: '800',
                    },
                    headerLeft: () => (
                        <Pressable onPress={toggle} style={{ padding: 4 }} hitSlop={8}>
                            <Ionicons name="menu-outline" size={26} color={colors.primary} />
                        </Pressable>
                    ),
                }}
            />
            <Animated.ScrollView
                style={styles.scrollView}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingTop: Platform.OS === 'ios' ? insets.top + 50 : insets.top + 60 }
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Controls Row */}
                <View style={styles.newHeaderRow}>
                    <ThemedText style={[styles.subtitle, { color: colors.text + '70' }]}>
                        {pendingTasks.length} pending · {completedTasks.length} done
                    </ThemedText>

                    <View style={styles.controlsGroup}>
                        <Pressable
                            onPress={cycleGroupBy}
                            style={[
                                styles.compactControlButton,
                                { backgroundColor: colors.primary + '15' },
                            ]}
                        >
                            <Ionicons name="layers-outline" size={14} color={colors.primary} />
                            <ThemedText style={[styles.controlButtonText, { color: colors.primary }]}>
                                {getGroupByLabel()}
                            </ThemedText>
                        </Pressable>

                        <Pressable
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                updateGeneralSettings({ tasksShowDone: !showCompleted });
                            }}
                            style={[
                                styles.compactControlButton,
                                {
                                    backgroundColor: showCompleted ? colors.primary + '15' : dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                },
                            ]}
                        >
                            <Ionicons
                                name={showCompleted ? 'eye' : 'eye-off'}
                                size={14}
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

                        <Pressable
                            onPress={() => router.push('/Tasks/new')}
                            style={({ pressed }) => [
                                styles.compactAddButton,
                                {
                                    backgroundColor: colors.primary,
                                    opacity: pressed ? 0.8 : 1,
                                },
                            ]}
                            hitSlop={8}
                        >
                            <Ionicons name="add" size={20} color="white" />
                        </Pressable>
                    </View>
                </View>

                {/* Tasks - Grouped */}
                {(groupedTasks?.length ?? 0) > 0 && (
                    <View style={styles.section}>
                        {groupedTasks?.map((group) => (
                            <CollapsibleGroup
                                key={group.id}
                                title={group.title}
                                color={group.color}
                                tasks={group.tasks}
                                icon={group.icon}
                                isCollapsed={collapsedGroups.has(group.id)}
                                onToggleCollapse={() => toggleGroupCollapse(group.id)}
                                onTaskPress={handleTaskPress}
                                onTaskToggle={handleToggle}
                                onNewTask={groupBy === 'folder' ? () => {
                                    router.push({
                                        pathname: '/Tasks/new',
                                        params: { folderId: group.id !== '__no_folder__' ? group.id : undefined }
                                    });
                                } : undefined}
                                compact={true}
                                isFolder={group.isFolder}
                                hideFolder={groupBy === 'folder'}
                            />
                        ))}
                    </View>
                )}

                {/* Completed Tasks */}
                {showCompleted && groupBy !== 'folder' && completedTasks.length > 0 && (
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

            </Animated.ScrollView>

            {/* Bottom Footer */}
            <View style={[
                styles.footer,
                {
                    paddingBottom: Math.max(insets.bottom, 10),
                    backgroundColor: colors.background,
                    borderTopColor: colors.border,
                }
            ]}>
                <View style={styles.footerContent}>
                    <View style={styles.footerSide} />

                    <FloatingActionButton
                        onPress={() => router.push('/Tasks/new')}
                        isFloating={false}
                        size={64}
                        style={{ marginTop: -32 }}
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
    newHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    controlsGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    compactControlButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    compactAddButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    subtitle: {
        fontSize: 13,
    },
    controlButtonText: {
        fontSize: 12,
        fontWeight: '600',
    },
    section: {
        marginBottom: 12,
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
        marginBottom: 8,
        marginTop: 4,
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
        paddingTop: 0,
        paddingHorizontal: 20,
    },
    footerContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    footerSide: {
        flex: 1,
        alignItems: 'flex-end',
        paddingTop: 10,
        minHeight: 48,
    },
});
