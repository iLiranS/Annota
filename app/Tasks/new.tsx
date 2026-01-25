import TaskForm, { TaskFormValues } from '@/components/TaskForm';
import { useTasksStore } from '@/stores/tasks-store';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

export default function NewTaskScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const { day } = useLocalSearchParams()
    // day is just number of the month
    const date = new Date();
    date.setDate(Number(day));

    // Get createTask from store
    const { createTask } = useTasksStore();

    const handleCreate = (values: TaskFormValues) => {
        createTask({
            title: values.title,
            description: values.description ?? '',
            deadline: values.deadline,
            isWholeDay: values.isWholeDay ?? false,
            folderId: values.folderId,
            isDirty: true,
        });

        router.back();
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
