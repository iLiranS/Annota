import ThemedText from '@/components/themed-text';
import { useNotesStore } from '@/stores/notes-store';
import { useTasksStore, type Task } from '@/stores/tasks-store';
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
    const { getNoteById } = useNotesStore();

    const linkedNote = task.linkedNoteId ? getNoteById(task.linkedNoteId) : null;

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
                    borderColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
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
                <View style={styles.taskItemHeader}>
                    <ThemedText
                        style={[
                            styles.taskItemTitle,
                            task.completed && { textDecorationLine: 'line-through', opacity: 0.7 },
                        ]}
                        numberOfLines={1}
                    >
                        {task.title}
                    </ThemedText>
                    {task.deadline && !task.isWholeDay && (
                        <ThemedText style={[styles.taskItemTime, { color: colors.text + '60' }]}>
                            {showDate ? formatDate(task.deadline) : formatTime(task.deadline)}
                        </ThemedText>
                    )}
                    {task.isWholeDay && (
                        <ThemedText style={[styles.taskItemTime, { color: colors.text + '60' }]}>
                            {formatDate(task.deadline)}
                        </ThemedText>
                    )}
                </View>

                {linkedNote && (
                    <View style={styles.linkedNoteRow}>
                        <Ionicons name="document-text" size={12} color={colors.primary} />
                        <ThemedText style={[styles.linkedNoteLabel, { color: colors.primary }]}>
                            {linkedNote.title}
                        </ThemedText>
                    </View>
                )}
            </View>

            <Ionicons name="chevron-forward" size={16} color={colors.text + '40'} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    taskItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 10,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 2,
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
    },
    taskItemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    taskItemTitle: {
        fontSize: 15,
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
    },
    taskItemTime: {
        fontSize: 12,
        fontWeight: '500',
    },
    linkedNoteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    linkedNoteLabel: {
        fontSize: 11,
        fontWeight: '600',
    },
});
