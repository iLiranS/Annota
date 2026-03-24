import { HapticPressable } from '@/components/ui/haptic-pressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { useSidebar } from '@/context/sidebar-context';
import React from 'react';

export default function NotesLayout() {
    const { colors } = useTheme();
    const { toggle } = useSidebar();

    return (
        <Stack
            screenOptions={{
                headerTitleStyle: { fontSize: 17, fontWeight: '600' },
                headerBackButtonDisplayMode: 'minimal',
                gestureEnabled: true,
            }}
        >
            <Stack.Screen
                name="index"
                options={{
                    title: 'Notes',
                    headerLeft: () => (
                        <HapticPressable
                            onPress={toggle}
                            style={{ padding: 4, marginLeft: -4 }}
                            hitSlop={8}
                        >
                            <Ionicons name="menu" size={26} color={colors.primary} />
                        </HapticPressable>
                    ),
                }}
            />

            <Stack.Screen
                name="[id]/index"
                options={{
                    title: 'Note',
                    // Drawer swipe disabled for editor (default Stack gesture only)
                }}
            />
            <Stack.Screen
                name="trash"
                options={{
                    title: 'Trash',
                }}
            />
        </Stack>
    );
}
