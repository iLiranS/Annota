import { Stack } from 'expo-router';

export default function TasksLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="[id]/index" options={{ headerShown: true, presentation: 'modal', title: 'Edit Task' }} />
        </Stack>
    );
}
