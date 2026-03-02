import { TaskForm, type TaskFormValues } from '@/components/tasks';
import ThemedText from '@/components/themed-text';
import { useTasksStore } from '@annota/core';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

export default function TaskEditScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { colors } = useTheme();

    // Get task from store
    const { getTaskById, updateTask, deleteTask } = useTasksStore();
    const task = getTaskById(id);

    // Show not found state if task doesn't exist
    if (!task) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <Stack.Screen
                    options={{
                        headerShown: true,
                        title: 'Task Not Found',
                        headerLeft: () => (
                            <Pressable onPress={() => router.back()} style={styles.headerButton} hitSlop={8}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </Pressable>
                        ),
                        headerRight: () => null,
                    }}
                />
                <View style={styles.notFoundContainer}>
                    <Ionicons name="alert-circle-outline" size={64} color={colors.text + '40'} />
                    <ThemedText style={[styles.notFoundText, { color: colors.text + '60' }]}>
                        Task not found
                    </ThemedText>
                </View>
            </View>
        );
    }

    const handleSave = (values: TaskFormValues) => {
        updateTask(task.id, {
            title: values.title,
            description: values.description ?? '',
            deadline: values.deadline,
            isWholeDay: values.isWholeDay ?? false,
            completed: values.completed ?? false,
            folderId: values.folderId,
            links: values.links,
        });

        router.back();
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Task',
            'Are you sure you want to delete this task?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        deleteTask(task.id);
                        router.back();
                    },
                },
            ]
        );
    };

    const handleClose = () => {
        router.back();
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Edit Task',
                    headerLeft: () => (
                        <Pressable onPress={handleClose} style={styles.headerButton} hitSlop={8}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </Pressable>
                    ),
                    headerRight: () => null, // Save button is inside form
                }}
            />

            <TaskForm
                initialValues={{
                    title: task.title,
                    description: task.description,
                    deadline: new Date(task.deadline),
                    isWholeDay: task.isWholeDay,
                    completed: task.completed,
                    folderId: task.folderId,
                    links: task.links,
                }}
                onSubmit={handleSave}
                onDelete={handleDelete}
                submitLabel="Save Changes"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerButton: {
        padding: 4,
    },
    notFoundContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    notFoundText: {
        fontSize: 18,
        fontWeight: '600',
    },
});
