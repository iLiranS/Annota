import ThemedText from '@/components/themed-text';
import type { Task } from '@annota/core';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { Pressable, StyleSheet, View } from 'react-native';
import { CompactTaskCard, TaskCard } from './TaskCard';

export interface CollapsibleGroupProps {
    title: string;
    color?: string;
    tasks: Task[];
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onTaskPress: (task: Task) => void;
    onTaskToggle: (taskId: string) => void;
    onNewTask?: () => void;
    compact: boolean;
    icon?: string;
    isFolder?: boolean;
    hideFolder?: boolean;
}

export function CollapsibleGroup({
    title,
    color,
    tasks,
    isCollapsed,
    onToggleCollapse,
    onTaskPress,
    onTaskToggle,
    onNewTask,
    compact,
    isFolder,
    icon,
    hideFolder,
}: CollapsibleGroupProps) {
    const { colors, dark } = useTheme();

    return (
        <View
            style={[
                styles.groupContainer,
                (isFolder && color) && {
                    backgroundColor: color + '12',
                    borderWidth: 1,
                    borderColor: color + '15',
                }
            ]}
        >
            <Pressable
                onPress={onToggleCollapse}
                style={[
                    styles.groupHeader,
                ]}
            >
                <View style={styles.groupHeaderLeft}>
                    <Ionicons
                        name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                        size={14}
                        color={color || colors.text + '60'}
                    />
                    {icon && (
                        <Ionicons
                            name={icon as any}
                            size={16}
                            color={color || colors.text + '70'}
                            style={{ marginLeft: 2 }}
                        />
                    )}
                    <ThemedText style={[styles.groupTitle, color && { color }]}>{title}</ThemedText>
                </View>

                <View style={[styles.taskCountBadge, { backgroundColor: (color || colors.primary) + '15' }]}>
                    <ThemedText style={[styles.taskCountText, { color: color || colors.primary }]}>
                        {tasks.length}
                    </ThemedText>
                </View>
            </Pressable>

            {!isCollapsed && (
                <View style={styles.groupContent}>
                    {onNewTask && (
                        <Pressable
                            onPress={onNewTask}
                            style={({ pressed }) => [
                                styles.newTaskButton,
                                pressed && { opacity: 0.6 }
                            ]}
                        >
                            <ThemedText style={[styles.newTaskText, { color: colors.text + '60' }]}>NEW TASK</ThemedText>
                            <Ionicons name="add" size={16} color={colors.text + '40'} />
                        </Pressable>
                    )}
                    {tasks.map((task) =>
                        compact ? (
                            <CompactTaskCard
                                key={task.id}
                                task={task}
                                onPress={() => onTaskPress(task)}
                                onToggle={() => onTaskToggle(task.id)}
                                hideFolder={hideFolder}
                            />
                        ) : (
                            <TaskCard
                                key={task.id}
                                task={task}
                                onPress={() => onTaskPress(task)}
                                onToggle={() => onTaskToggle(task.id)}
                                hideFolder={hideFolder}
                            />
                        )
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    groupContainer: {
        marginBottom: 8,
        borderRadius: 12,
        overflow: 'hidden',
    },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    groupHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    groupTitle: {
        fontSize: 13,
        fontWeight: '600',
    },
    taskCountBadge: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    taskCountText: {
        fontSize: 10,
        fontWeight: '700',
    },
    groupContent: {
        paddingHorizontal: 6,
        paddingBottom: 4,
    },
    newTaskButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        paddingVertical: 8,
        opacity: 0.5,
    },
    newTaskText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});
