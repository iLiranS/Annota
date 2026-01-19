import Ionicons from '@expo/vector-icons/Ionicons';
import { DrawerActions, useTheme } from '@react-navigation/native';
import { Stack, useNavigation } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';

export default function NotesLayout() {
    const { colors } = useTheme();
    const navigation = useNavigation();

    const openDrawer = () => {
        navigation.dispatch(DrawerActions.openDrawer());
    };

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
                        <Pressable
                            onPress={openDrawer}
                            style={{ padding: 4, marginLeft: -4 }}
                            hitSlop={8}
                        >
                            <Ionicons name="menu" size={26} color={colors.primary} />
                        </Pressable>
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
