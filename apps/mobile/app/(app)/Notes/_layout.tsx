import { Stack } from 'expo-router';
import React from 'react';

export default function NotesLayout() {
    return (
        <Stack
            screenOptions={{
                headerTitleStyle: { fontSize: 17, fontWeight: '600' },
                headerBackButtonDisplayMode: 'minimal',
                gestureEnabled: true,
            }}
        >
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
