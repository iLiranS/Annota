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
    compact,
    isFolder,
    icon,
    hideFolder,
}: CollapsibleGroupProps) {
    const { colors, dark } = useTheme();

    return (
        <View style={styles.groupContainer}>
            <Pressable
                onPress={onToggleCollapse}
                style={[styles.groupHeader, { backgroundColor: dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }]}
            >
                <View style={styles.groupHeaderLeft}>
                    <Ionicons
                        name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                        size={14}
                        color={color || colors.text + '60'}
                    />
                    {isFolder && (
                        <Ionicons
                            name={icon as any ?? "folder-outline"}
                            size={16}
                            color={color || colors.text + '70'}
                            style={{ marginLeft: 2 }}
                        />
                    )}
                    <ThemedText style={[styles.groupTitle, color && { color }]}>{title}</ThemedText>
                </View>

                <View style={[styles.taskCountBadge, { backgroundColor: colors.primary + '15' }]}>
                    <ThemedText style={[styles.taskCountText, { color: colors.primary }]}>
                        {tasks.length}
                    </ThemedText>
                </View>
            </Pressable>

            {!isCollapsed && (
                <View style={styles.groupContent}>
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
        marginBottom: 12,
    },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
        marginBottom: 6,
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
        paddingLeft: 4,
    },
});
