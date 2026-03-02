import ThemedText from '@/components/themed-text';
import { useNotesStore } from '@annota/core';
import { useTasksStore, type Task } from '@annota/core';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { Pressable, StyleSheet, View } from 'react-native';

interface TaskItemProps {
    task: Task;
    onPress: () => void;
    /** If true, shows the full date instead of just time */
    showDate?: boolean;
}

export default function TaskItem({ task, onPress, showDate = false }: TaskItemProps) {
    const { colors, dark } = useTheme();
    const { toggleComplete } = useTasksStore();
    const { getFolderById } = useNotesStore();

    const linkedFolder = task.folderId ? getFolderById(task.folderId) : null;

    const formatTime = (date: Date): string => {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const formatDate = (date: Date): string => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const isToday =
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();

        const isTomorrow =
            date.getDate() === tomorrow.getDate() &&
            date.getMonth() === tomorrow.getMonth() &&
            date.getFullYear() === tomorrow.getFullYear();

        const timeStr = formatTime(date);

        // If whole day, just show "Today" or "Tomorrow" without time
        if (task.isWholeDay) {
            if (isToday) return 'Today';
            if (isTomorrow) return 'Tomorrow';
            return date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
            });
        }

        if (isToday) return `Today, ${timeStr}`;
        if (isTomorrow) return `Tomorrow, ${timeStr}`;

        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
    };

    const handleToggle = () => {
        toggleComplete(task.id);
    };

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.taskItem,
                {
                    backgroundColor: dark ? 'rgba(255,255,255,0.04)' : colors.card,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                    opacity: task.completed ? 0.6 : pressed ? 0.9 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                },
            ]}
        >
            {/* Completion indicator (Interactive Circle) */}
            <Pressable
                onPress={handleToggle}
                style={[
                    styles.toggleCircle,
                    { borderColor: colors.primary },
                    task.completed && { backgroundColor: colors.primary },
                ]}
                hitSlop={12}
            >
                {task.completed && (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                )}
            </Pressable>

            <View style={styles.taskItemContent}>
                <View style={styles.titleRow}>
                    <ThemedText
                        style={[
                            styles.taskItemTitle,
                            task.completed && { textDecorationLine: 'line-through', opacity: 0.7 },
                        ]}
                        numberOfLines={1}
                    >
                        {task.title}
                    </ThemedText>

                    {linkedFolder && (
                        <View style={[
                            styles.folderBadge,
                            { backgroundColor: (linkedFolder.color || colors.primary) + '15' }
                        ]}>
                            <Ionicons name="folder" size={10} color={linkedFolder.color || colors.primary} />
                            <ThemedText style={[styles.folderLabel, { color: linkedFolder.color || colors.primary }]}>
                                {linkedFolder.name}
                            </ThemedText>
                        </View>
                    )}
                </View>
            </View>

            <View style={styles.rightSection}>
                {task.deadline && (
                    <View style={styles.timeContainer}>
                        <ThemedText style={[
                            styles.taskItemTime,
                            {
                                color: (() => {
                                    if (task.completed) return colors.text + '40';
                                    if (task.isWholeDay) return colors.text + '60';
                                    const now = new Date();
                                    const diff = task.deadline.getTime() - now.getTime();
                                    if (diff < 0) return '#EF4444';
                                    if (diff < 3600000) return '#F59E0B';
                                    return colors.text + '60';
                                })()
                            }
                        ]}>
                            {task.isWholeDay ? formatDate(task.deadline) : (showDate ? formatDate(task.deadline) : formatTime(task.deadline))}
                        </ThemedText>
                    </View>
                )}
                <Ionicons name="chevron-forward" size={16} color={colors.text + '40'} />
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    taskItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 14,
        marginBottom: 0,
    },
    toggleCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    taskItemContent: {
        flex: 1,
        justifyContent: 'center',
    },
    taskItemTitle: {
        fontSize: 16,
        fontWeight: '600',
        flexShrink: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginLeft: 8,
    },
    timeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    taskItemTime: {
        fontSize: 12,
        fontWeight: '500',
    },
    folderBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        gap: 4,
    },
    folderLabel: {
        fontSize: 11,
        fontWeight: '600',
    },
});
