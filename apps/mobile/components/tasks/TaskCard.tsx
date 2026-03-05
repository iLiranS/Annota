import ThemedText from '@/components/themed-text';
import type { Task } from '@annota/core';
import { useNotesStore } from '@annota/core';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { Pressable, StyleSheet, View } from 'react-native';

export interface TaskCardProps {
    task: Task;
    onToggle: () => void;
    onPress: () => void;
    hideFolder?: boolean;
}

// ============ COMPACT TASK CARD ============

export function CompactTaskCard({ task, onToggle, onPress, hideFolder }: TaskCardProps) {
    const { colors, dark } = useTheme();
    const { getFolderById } = useNotesStore();
    const linkedFolder = task.folderId ? getFolderById(task.folderId) : null;

    const now = new Date();
    const isToday =
        task.deadline.getDate() === now.getDate() &&
        task.deadline.getMonth() === now.getMonth() &&
        task.deadline.getFullYear() === now.getFullYear();

    const isTaskInPast = task.isWholeDay
        ? (new Date(task.deadline.getFullYear(), task.deadline.getMonth(), task.deadline.getDate()) < new Date(now.getFullYear(), now.getMonth(), now.getDate()))
        : (task.deadline < now);
    const isTaskOverdue = isTaskInPast && !task.completed;
    const deadlineColor = isTaskOverdue ? '#EF4444' : isToday ? '#F59E0B' : colors.text + '80';

    const formatDeadline = (date: Date): string => {
        const isToday =
            date.getDate() === now.getDate() &&
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear();

        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const isTomorrow =
            date.getDate() === tomorrow.getDate() &&
            date.getMonth() === tomorrow.getMonth() &&
            date.getFullYear() === tomorrow.getFullYear();

        if (isToday && !task.isWholeDay) {
            return date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            }).toLowerCase();
        }
        if (isTomorrow) return 'Tomorrow';
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
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

            {/* Folder Badge */}
            {linkedFolder && !hideFolder && (
                <View style={[styles.inlineBadge, { backgroundColor: linkedFolder.color + '10', borderColor: 'transparent', paddingHorizontal: 4, marginLeft: 4, gap: 3 }]}>
                    <Ionicons name="folder" size={8} color={linkedFolder.color || colors.primary} />
                    <ThemedText numberOfLines={1} style={[styles.inlineBadgeText, { color: linkedFolder.color || colors.primary, fontSize: 9 }]}>
                        {linkedFolder.name}
                    </ThemedText>
                </View>
            )}

            {/* Date */}
            <ThemedText style={[styles.compactDate, { color: deadlineColor }]}>
                {formatDeadline(task.deadline)}
            </ThemedText>
        </Pressable>
    );
}

// ============ REGULAR TASK CARD ============

export function TaskCard({ task, onToggle, onPress, hideFolder }: TaskCardProps) {
    const { colors, dark } = useTheme();
    const { getFolderById } = useNotesStore();
    const linkedFolder = task.folderId ? getFolderById(task.folderId) : null;

    const now = new Date();
    const isPastDay =
        new Date(task.deadline).setHours(0, 0, 0, 0) <
        new Date(now).setHours(0, 0, 0, 0);

    const isToday =
        task.deadline.getDate() === now.getDate() &&
        task.deadline.getMonth() === now.getMonth() &&
        task.deadline.getFullYear() === now.getFullYear();

    const isTaskInPast = task.isWholeDay
        ? (new Date(task.deadline.getFullYear(), task.deadline.getMonth(), task.deadline.getDate()) < new Date(now.getFullYear(), now.getMonth(), now.getDate()))
        : (task.deadline < now);
    const isTaskOverdue = isTaskInPast && !task.completed;
    const deadlineColor = isTaskOverdue ? '#EF4444' : isToday ? '#F59E0B' : colors.text + '80';

    const formatDeadline = (date: Date): string => {
        const isToday =
            date.getDate() === now.getDate() &&
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear();

        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const isTomorrow =
            date.getDate() === tomorrow.getDate() &&
            date.getMonth() === tomorrow.getMonth() &&
            date.getFullYear() === tomorrow.getFullYear();

        if (isToday && !task.isWholeDay) {
            return date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            }).toLowerCase();
        }
        if (isTomorrow) return 'Tomorrow';
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
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
                <View style={styles.titleRow}>
                    <ThemedText
                        style={[
                            styles.taskTitle,
                            task.completed && { textDecorationLine: 'line-through', opacity: 0.7 },
                        ]}
                        numberOfLines={1}
                    >
                        {task.title}
                    </ThemedText>

                    {linkedFolder && !hideFolder && (
                        <View style={[styles.inlineBadge, { backgroundColor: linkedFolder.color + '15', borderColor: linkedFolder.color + '30' }]}>
                            <Ionicons name="folder" size={10} color={linkedFolder.color || colors.primary} />
                            <ThemedText numberOfLines={1} style={[styles.inlineBadgeText, { color: linkedFolder.color || colors.primary }]}>
                                {linkedFolder.name}
                            </ThemedText>
                        </View>
                    )}

                    <ThemedText style={[styles.deadlineText, { color: deadlineColor }]}>
                        {formatDeadline(task.deadline)}
                    </ThemedText>
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
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 4,
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
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    taskTitle: {
        fontSize: 15,
        fontWeight: '600',
        flexGrow: 1,
        flexShrink: 1,
    },
    inlineBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 1,
        flexShrink: 4,
    },
    inlineBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        flexShrink: 1,
    },
    deadlineText: {
        fontSize: 11,
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
        fontSize: 13,
        fontWeight: '500',
        flexGrow: 1,
        flexShrink: 1,
    },
    compactDate: {
        fontSize: 11,
        fontWeight: '500',
        marginLeft: 8,
    },
});
