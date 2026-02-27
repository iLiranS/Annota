import ThemedText from '@/components/themed-text';
import { useNotesStore } from '@/lib/stores/notes.store';
import type { Task } from '@/lib/stores/tasks.store';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { Pressable, StyleSheet, View } from 'react-native';

export interface TaskCardProps {
    task: Task;
    onToggle: () => void;
    onPress: () => void;
}

// ============ COMPACT TASK CARD ============

export function CompactTaskCard({ task, onToggle, onPress }: TaskCardProps) {
    const { colors, dark } = useTheme();
    const now = new Date();
    const isOverdue = task.deadline < now && !task.completed;
    const isToday =
        task.deadline.getDate() === now.getDate() &&
        task.deadline.getMonth() === now.getMonth() &&
        task.deadline.getFullYear() === now.getFullYear();

    const deadlineColor = isOverdue ? '#EF4444' : isToday ? '#F59E0B' : colors.text + '80';

    const formatShortDate = (date: Date): string => {
        const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    };

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.compactCard,
                {
                    backgroundColor: dark ? 'rgba(255,255,255,0.03)' : colors.card,
                    borderColor: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    opacity: task.completed ? 0.5 : pressed ? 0.8 : 1,
                },
            ]}
        >
            {/* Checkbox */}
            <Pressable onPress={onToggle} style={styles.compactCheckbox} hitSlop={8}>
                <View
                    style={[
                        styles.compactCheckboxInner,
                        {
                            backgroundColor: task.completed ? '#10B981' : 'transparent',
                            borderColor: task.completed ? '#10B981' : colors.text + '40',
                        },
                    ]}
                >
                    {task.completed && <Ionicons name="checkmark" size={10} color="#FFFFFF" />}
                </View>
            </Pressable>

            {/* Title */}
            <ThemedText
                style={[
                    styles.compactTitle,
                    task.completed && { textDecorationLine: 'line-through', opacity: 0.6 },
                ]}
                numberOfLines={1}
            >
                {task.title}
            </ThemedText>

            {/* Date */}
            <ThemedText style={[styles.compactDate, { color: deadlineColor }]}>
                {formatShortDate(task.deadline)}
            </ThemedText>
        </Pressable>
    );
}

// ============ REGULAR TASK CARD ============

export function TaskCard({ task, onToggle, onPress }: TaskCardProps) {
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
            ...(task.isWholeDay ? {} : {
                hour: 'numeric',
                minute: '2-digit',
            }),
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
                    {task.completed && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
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
                {task.description ? (
                    <ThemedText style={[styles.taskDescription, { color: colors.text + '70' }]} numberOfLines={1}>
                        {task.description}
                    </ThemedText>
                ) : null}

                <View style={styles.taskMeta}>
                    <View style={styles.deadlineBadge}>
                        <Ionicons name="time-outline" size={11} color={deadlineColor} />
                        <ThemedText style={[styles.deadlineText, { color: deadlineColor }]}>
                            {formatDeadline(task.deadline)}
                        </ThemedText>
                    </View>

                    {linkedFolder && (
                        <View style={[styles.linkedNoteBadge, { backgroundColor: linkedFolder.color + '20' }]}>
                            <Ionicons name="folder" size={9} color={linkedFolder.color || colors.primary} />
                            <ThemedText style={[styles.linkedNoteText, { color: linkedFolder.color || colors.primary }]}>
                                {linkedFolder.name}
                            </ThemedText>
                        </View>
                    )}
                </View>
            </View>

            {/* Chevron */}
            <Ionicons name="chevron-forward" size={16} color={colors.text + '40'} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    // Regular Task Card
    taskCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 2,
    },
    checkbox: {
        marginRight: 10,
    },
    checkboxInner: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    taskContent: {
        flex: 1,
    },
    taskTitle: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 1,
    },
    taskDescription: {
        fontSize: 12,
        marginBottom: 6,
    },
    taskMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    deadlineBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    deadlineText: {
        fontSize: 10,
        fontWeight: '500',
    },
    linkedNoteBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4,
    },
    linkedNoteText: {
        fontSize: 9,
        fontWeight: '600',
    },
    // Compact Task Card
    compactCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 4,
    },
    compactCheckbox: {
        marginRight: 8,
    },
    compactCheckboxInner: {
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    compactTitle: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
    },
    compactDate: {
        fontSize: 11,
        fontWeight: '500',
        marginLeft: 8,
    },
});
