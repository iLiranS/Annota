import { TaskForm, type TaskFormValues } from '@/components/tasks';
import { useTasksStore } from '@annota/core';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

export default function NewTaskScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const { date: dateParam } = useLocalSearchParams<{ date?: string }>()
    const date = dateParam ? new Date(dateParam) : new Date();

    // Get createTask from store
    const { createTask } = useTasksStore();

    const handleCreate = async (values: TaskFormValues) => {
        try {
            await createTask({
                title: values.title,
                description: values.description ?? '',
                deadline: values.deadline,
                isWholeDay: values.isWholeDay ?? false,
                folderId: values.folderId,
                links: values.links,
                isDirty: true,
            });

            router.back();
        } catch (error) {
            console.error('Failed to create task', error);
        }
    };

    const handleClose = () => {
        router.back();
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'New Task',
                    headerLeft: () => (
                        <Pressable onPress={handleClose} style={styles.headerButton} hitSlop={8}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </Pressable>
                    ),
                    headerRight: () => null, // Save button is inside form now
                }}
            />

            <TaskForm initialDate={date} onSubmit={handleCreate} submitLabel="Create Task" />
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
});
