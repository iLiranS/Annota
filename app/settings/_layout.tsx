import { useAppTheme } from '@/hooks/use-app-theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

export default function SettingsLayout() {
    const { colors } = useAppTheme();
    const router = useRouter();

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: colors.card,
                },
                headerTintColor: colors.text,
                headerTitleStyle: {
                    fontWeight: '600',
                },
                headerLeft: ({ canGoBack }) =>
                    canGoBack ? (
                        <Pressable
                            onPress={() => router.back()}
                            style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}
                        >
                            <Ionicons name="chevron-back" size={24} color={colors.primary} />
                        </Pressable>
                    ) : undefined,
                headerRight: () => (
                    <Pressable
                        onPress={() => router.dismissAll()}
                        style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }}
                    >
                        <Ionicons name="close" size={24} color={colors.primary} />
                    </Pressable>
                ),
            }}
        >
            <Stack.Screen
                name="index"
                options={{
                    title: 'Settings',
                    // headerLargeTitle: true,
                    headerShadowVisible: false,


                }}
            />
            <Stack.Screen
                name="theme"
                options={{
                    title: 'Appearance',
                    presentation: 'card',
                }}
            />
            <Stack.Screen
                name="editor"
                options={{
                    title: 'Editor',
                    presentation: 'card',
                }}
            />
            <Stack.Screen
                name="general"
                options={{
                    title: 'General',
                    presentation: 'card',
                }}
            />
        </Stack>
    );
}
