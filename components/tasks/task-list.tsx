import { TaskCard } from '@/components/tasks/TaskCard';
import ThemedText from '@/components/themed-text';
import { useSettingsStore } from '@/lib/stores/settings.store';
import { Task, useTasksStore } from '@/lib/stores/tasks.store';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, View } from 'react-native';

interface TaskListProps {
    tasks: Task[];
    selectedDate: Date;
    onTaskPress: (task: Task) => void;
    showComingUp?: boolean;
    upcomingTasks?: Task[];
}

export default function TaskList({
    tasks,
    selectedDate,
    onTaskPress,
    showComingUp = false,
    upcomingTasks = []
}: TaskListProps) {
    const { colors, dark } = useTheme();
    const router = useRouter();
    const { general, updateGeneralSettings } = useSettingsStore();
    const { toggleComplete } = useTasksStore();
    const showCompleted = general.taskListShowDone;

    const isToday = useMemo(() => {
        const today = new Date();
        return (
            selectedDate.getDate() === today.getDate() &&
            selectedDate.getMonth() === today.getMonth() &&
            selectedDate.getFullYear() === today.getFullYear()
        );
    }, [selectedDate]);

    // Format tasks for the selected day
    const sortedTasks = useMemo(() => {
        const displayedTasks = showCompleted ? tasks : tasks.filter(t => !t.completed);

        const timeSpecific = displayedTasks.filter(t => !t.isWholeDay);
        const wholeDay = displayedTasks.filter(t => t.isWholeDay);

        // Sort time specific by deadline (closest first)
        timeSpecific.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());

        // Sort whole day by createdAt (creation default order)
        wholeDay.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        return [...timeSpecific, ...wholeDay];
    }, [tasks, showCompleted]);


    const handleAddTask = () => {
        router.push({
            pathname: '/Tasks/new',
            params: { date: selectedDate.toISOString() }
        });
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <ThemedText style={[styles.title, { color: colors.text + '80' }]}>
                    {isToday ? "Today's Focus" : `Tasks for ${selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`}
                </ThemedText>

                <View style={styles.headerRight}>
                    {/* Toggle Completed */}
                    <Pressable
                        onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            updateGeneralSettings({ taskListShowDone: !showCompleted });
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
                        onPress={handleAddTask}
                        style={({ pressed }) => [
                            styles.addButton,
                            {
                                backgroundColor: colors.primary + '90',
                                opacity: pressed ? 0.8 : 1
                            }
                        ]}
                        hitSlop={8}
                    >
                        <Ionicons name="add" size={20} color="#FFFFFF" />
                    </Pressable>
                </View>
            </View>

            {/* Main Content Area */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                style={styles.mainScroll}
            >
                {/* Tasks List */}
                <View style={styles.listWrapper}>
                    {sortedTasks.length > 0 ? (
                        sortedTasks.map((task) => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                onPress={() => onTaskPress(task)}
                                onToggle={() => toggleComplete(task.id)}
                            />
                        ))
                    ) : (
                        <Pressable
                            onPress={handleAddTask}
                            style={({ pressed }) => [
                                styles.emptyState,
                                {
                                    backgroundColor: dark ? 'rgba(255,255,255,0.02)' : colors.card,
                                    borderColor: pressed ? colors.primary + '40' : colors.border,
                                    opacity: pressed ? 0.8 : 1,
                                }
                            ]}
                        >
                            <Ionicons name="calendar-outline" size={40} color={colors.primary + '30'} />
                            <ThemedText style={[styles.emptyText, { color: colors.text + '40' }]}>
                                No tasks scheduled
                            </ThemedText>
                            <ThemedText style={[styles.tapToAddText, { color: colors.text + '40', fontWeight: '700' }]}>
                                Tap to add task
                            </ThemedText>
                        </Pressable>
                    )}
                </View>

                {/* Coming Up Section */}
                {showComingUp && upcomingTasks.length > 0 && (
                    <View style={styles.upcomingSection}>
                        <View style={styles.upcomingHeader}>
                            <Ionicons name="calendar-outline" size={14} color={colors.text + '40'} />
                            <ThemedText style={[styles.upcomingHeaderText, { color: colors.text + '40' }]}>
                                Coming Up
                            </ThemedText>
                        </View>

                        <View style={styles.upcomingList}>
                            {upcomingTasks.map((task) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    onPress={() => onTaskPress(task)}
                                    onToggle={() => toggleComplete(task.id)}
                                />
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        minHeight: 32,
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
        letterSpacing: -0.3,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    addButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    mainScroll: {
        flex: 1,
    },
    listWrapper: {
        flex: 1,

    },
    scrollContent: {
        paddingBottom: 20,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 32,
        borderRadius: 20,
        borderWidth: 1,
    },
    emptyText: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 8,
    },
    tapToAddText: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    upcomingSection: {
        marginTop: 20,
    },
    upcomingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
    },
    upcomingHeaderText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    upcomingList: {

    },
    controlButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    controlButtonText: {
        fontSize: 12,
        fontWeight: '600',
    },
});
