import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

export default function SettingsLayout() {
    const { colors, dark } = useTheme();
    const router = useRouter();

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: colors.background,
                },
                headerTintColor: colors.text,
                headerTitleStyle: {
                    fontWeight: '600',
                },
                headerLeft: ({ canGoBack }) =>
                    canGoBack ? (
                        <Pressable onPress={() => router.back()} style={{ marginRight: 16 }}>
                            <Ionicons name="chevron-back" size={24} color={colors.primary} />
                        </Pressable>
                    ) : undefined
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
