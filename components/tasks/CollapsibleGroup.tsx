import ThemedText from '@/components/themed-text';
import type { Task } from '@/lib/stores/tasks.store';
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
                    <ThemedText style={[styles.groupTitle, color && { color }]}>{title}</ThemedText>
                    <View style={[styles.groupBadge, { backgroundColor: (color || colors.primary) + '20' }]}>
                        <ThemedText style={[styles.groupBadgeText, { color: color || colors.primary }]}>
                            {tasks.length}
                        </ThemedText>
                    </View>
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
                            />
                        ) : (
                            <TaskCard
                                key={task.id}
                                task={task}
                                onPress={() => onTaskPress(task)}
                                onToggle={() => onTaskToggle(task.id)}
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
    groupBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    groupBadgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    groupContent: {
        paddingLeft: 4,
    },
});
