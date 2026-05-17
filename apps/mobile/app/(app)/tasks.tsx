import { HapticPressable } from '@/components/ui/haptic-pressable';
import ThemedText from '@/components/themed-text';
import { useSidebar } from '@/context/sidebar-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
    SearchRepository,
    useNotesStore,
    type PendingTask,
    type PendingTaskNote
} from '@annota/core';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useState, useRef } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View
} from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    LinearTransition
} from 'react-native-reanimated';

/**
 * Safely applies opacity to any hex color string (supporting 3, 6, or 8 characters).
 * Converts 8-character hex strings (RRGGBBAA) to 6-character hex strings before
 * appending the new hex alpha value, preventing crashes on invalid 10-character hex colors.
 */
function withOpacity(hex: string, hexAlpha: string): string {
    if (!hex) return 'transparent';
    let clean = hex.startsWith('#') ? hex.slice(1) : hex;
    if (clean.length === 8) {
        clean = clean.substring(0, 6);
    }
    return `#${clean}${hexAlpha}`;
}

interface TaskNoteGroupProps {
    group: PendingTaskNote;
    onTaskComplete: (noteId: string, taskIndex: number) => Promise<void>;
    onNavigate: (noteId: string, folderId: string | null) => void;
    completingKeys: Set<string>;
}

function TaskNoteGroup({ group, onTaskComplete, onNavigate, completingKeys }: TaskNoteGroupProps) {
    const [collapsed, setCollapsed] = useState(true);
    const { colors } = useAppTheme();

    return (
        <Animated.View
            layout={LinearTransition}
            style={[
                styles.groupContainer,
                {
                    backgroundColor: colors.card,
                    borderColor: withOpacity(colors.border, '40'),
                }
            ]}
        >
            {/* Note Header */}
            <View style={styles.groupHeaderRow}>
                <Pressable
                    style={({ pressed }) => [
                        styles.groupHeaderTitleContainer,
                        pressed && { backgroundColor: withOpacity(colors.border, '15') }
                    ]}
                    onPress={() => setCollapsed(c => !c)}
                >
                    <Ionicons
                        name="chevron-down"
                        size={14}
                        color={withOpacity(colors.text, '80')}
                        style={[
                            styles.chevronIcon,
                            collapsed && { transform: [{ rotate: '-90deg' }] }
                        ]}
                    />
                    <Text
                        style={[styles.groupTitleText, { color: colors.text }]}
                        numberOfLines={1}
                    >
                        {group.noteTitle}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: withOpacity(colors.border, '25') }]}>
                        <Text style={[styles.taskCountText, { color: withOpacity(colors.text, '80') }]}>
                            {group.tasks.length}
                        </Text>
                    </View>
                </Pressable>

                <HapticPressable
                    onPress={() => onNavigate(group.noteId, group.folderId)}
                    style={({ pressed }) => [
                        styles.openNoteButton,
                        pressed && { opacity: 0.6 }
                    ]}
                    hitSlop={12}
                >
                    <Ionicons name="open-outline" size={16} color={colors.primary} />
                </HapticPressable>
            </View>

            {/* Task Items */}
            {!collapsed && (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(150)}
                    style={[styles.tasksList, { borderTopWidth: 1, borderTopColor: withOpacity(colors.border, '15') }]}
                >
                    {group.tasks.map((task: PendingTask) => {
                        const key = `${group.noteId}:${task.index}`;
                        const isCompleting = completingKeys.has(key);
                        return (
                            <View
                                key={key}
                                style={[
                                    styles.taskItemRow,
                                    { borderBottomWidth: 1, borderBottomColor: withOpacity(colors.border, '10') },
                                    isCompleting && { opacity: 0.5 }
                                ]}
                            >
                                <HapticPressable
                                    onPress={() => onTaskComplete(group.noteId, task.index)}
                                    disabled={isCompleting}
                                    style={({ pressed }) => [
                                        styles.checkboxButton,
                                        { borderColor: withOpacity(colors.text, '30') },
                                        isCompleting && { borderColor: colors.primary, backgroundColor: withOpacity(colors.primary, '15') },
                                        pressed && { scale: 0.92 }
                                    ]}
                                >
                                    {isCompleting && (
                                        <View style={[styles.checkboxDot, { backgroundColor: colors.primary }]} />
                                    )}
                                </HapticPressable>
                                <Text
                                    style={[styles.taskText, { color: withOpacity(colors.text, 'dd') }]}
                                    selectable
                                >
                                    {task.text}
                                </Text>
                            </View>
                        );
                    })}
                </Animated.View>
            )}
        </Animated.View>
    );
}

export default function TasksScreen() {
    const { colors } = useAppTheme();
    const router = useRouter();
    const { toggle } = useSidebar();

    const [groups, setGroups] = useState<PendingTaskNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [completingKeys, setCompletingKeys] = useState<Set<string>>(new Set());
    const mountedRef = useRef(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const result = await SearchRepository.findNotesWithPendingTasks();
            if (mountedRef.current) setGroups(result);
        } catch (err) {
            console.error('[Tasks] Failed to load pending tasks:', err);
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            mountedRef.current = true;
            load();
            return () => {
                mountedRef.current = false;
            };
        }, [load])
    );

    const handleTaskComplete = useCallback(async (noteId: string, taskIndex: number) => {
        const key = `${noteId}:${taskIndex}`;
        setCompletingKeys(prev => new Set([...prev, key]));

        try {
            // Read the current full HTML content via the store (same as editor)
            const html = await useNotesStore.getState().getNoteContent(noteId);

            // Replace exactly the n-th occurrence of data-checked="false" → data-checked="true"
            let occurrence = 0;
            const updated = html.replace(
                /(<li[^>]*)(data-checked="false")([^>]*>)/gi,
                (_match, before, _attr, after) => {
                    if (occurrence === taskIndex) {
                        occurrence++;
                        return `${before}data-checked="true"${after}`;
                    }
                    occurrence++;
                    return `${before}data-checked="false"${after}`;
                }
            );

            if (updated === html) return; // Nothing changed, bail

            // Delegate to the store — handles dirty flag, versioning, preview, and sync notification
            await useNotesStore.getState().updateNoteContent(noteId, updated);

            // Optimistic UI: remove the task from local state
            if (mountedRef.current) {
                setGroups(prev =>
                    prev
                        .map(g => {
                            if (g.noteId !== noteId) return g;
                            const newTasks = g.tasks
                                .filter(t => t.index !== taskIndex)
                                // Reindex remaining tasks to stay consistent
                                .map((t, i) => ({ ...t, index: i }));
                            return { ...g, tasks: newTasks };
                        })
                        .filter(g => g.tasks.length > 0)
                );
            }
        } catch (err) {
            console.error('[Tasks] Failed to complete task:', err);
        } finally {
            if (mountedRef.current) {
                setCompletingKeys(prev => {
                    const next = new Set(prev);
                    next.delete(key);
                    return next;
                });
            }
        }
    }, []);

    const handleNavigate = useCallback((noteId: string) => {
        router.push({ pathname: '/Notes/[id]', params: { id: noteId } });
    }, [router]);

    const totalTasks = groups.reduce((acc, g) => acc + g.tasks.length, 0);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    gestureEnabled: false,
                    headerTransparent: false,
                    headerBackVisible: false,
                    headerTitleAlign: 'left',
                    headerTitle: () => (
                        <View style={styles.headerTitleContainer}>
                            <Ionicons name="checkbox" size={20} color={colors.primary} />
                            <ThemedText style={styles.headerTitleText}>Tasks</ThemedText>
                        </View>
                    ),
                    headerLeft: ({ canGoBack }: { canGoBack?: boolean }) => {
                        return (
                            <HapticPressable
                                onPress={() => canGoBack ? router.back() : toggle()}
                                style={styles.headerButton}
                                hitSlop={8}
                            >
                                <Ionicons name={canGoBack ? "chevron-back" : "menu"} size={24} color={colors.primary} />
                            </HapticPressable>
                        );
                    },
                    headerRight: () => (
                        <HapticPressable
                            onPress={load}
                            disabled={loading}
                            style={[styles.headerButton, loading && { opacity: 0.3 }]}
                            hitSlop={8}
                        >
                            <Ionicons name="refresh" size={22} color={colors.primary} />
                        </HapticPressable>
                    )
                }}
            />

            {/* Toolbar / Subheader */}
            <View style={[styles.toolbar, { borderBottomColor: withOpacity(colors.border, '15') }]}>
                <Text style={[styles.toolbarText, { color: withOpacity(colors.text, '60') }]}>
                    {loading ? 'Loading...' : `${totalTasks} pending task${totalTasks !== 1 ? 's' : ''}`}
                </Text>
                {loading && (
                    <ActivityIndicator size="small" color={colors.primary} style={styles.toolbarLoading} />
                )}
            </View>

            {/* Content List */}
            <FlatList
                data={groups}
                keyExtractor={(item) => item.noteId}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={loading && groups.length > 0}
                        onRefresh={load}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                    />
                }
                renderItem={({ item }) => (
                    <TaskNoteGroup
                        group={item}
                        onTaskComplete={handleTaskComplete}
                        onNavigate={handleNavigate}
                        completingKeys={completingKeys}
                    />
                )}
                ListEmptyComponent={
                    loading && groups.length === 0 ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={[styles.emptySubtitleText, { color: withOpacity(colors.text, '50'), marginTop: 12 }]}>
                                Scanning notes for tasks...
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="checkbox-outline" size={60} color={colors.border} />
                            <Text style={[styles.emptyTitleText, { color: colors.text }]}>All done!</Text>
                            <Text style={[styles.emptySubtitleText, { color: withOpacity(colors.text, '50') }]}>
                                No pending tasks found across your notes.
                            </Text>
                        </View>
                    )
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginLeft: -8,
    },
    headerTitleText: {
        fontSize: 18,
        fontWeight: '700',
    },
    headerButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    toolbarText: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    toolbarLoading: {
        marginLeft: 8,
    },
    listContent: {
        padding: 12,
        gap: 12,
        paddingBottom: 60,
    },
    groupContainer: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
    },
    groupHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    groupHeaderTitleContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
    },
    chevronIcon: {
        marginRight: 8,
    },
    groupTitleText: {
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
    },
    badge: {
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 1,
        minWidth: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    taskCountText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    openNoteButton: {
        padding: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tasksList: {
        paddingVertical: 4,
    },
    taskItemRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    checkboxButton: {
        width: 16,
        height: 16,
        borderRadius: 4,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        marginTop: 2,
    },
    checkboxDot: {
        width: 8,
        height: 8,
        borderRadius: 2,
    },
    taskText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
        gap: 8,
    },
    emptyTitleText: {
        fontSize: 16,
        fontWeight: '700',
        marginTop: 8,
    },
    emptySubtitleText: {
        fontSize: 12,
        textAlign: 'center',
        maxWidth: 240,
    },
});
