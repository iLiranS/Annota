
import { Stack } from 'expo-router';
import React from 'react';



export default function TabLayout() {

    return (
        <Stack screenOptions={{
            headerTitleStyle: { fontSize: 16 },
            headerBackButtonDisplayMode: 'minimal',



        }}>
            <Stack.Screen name="index" options={{ title: "Notes" }} />
        </Stack>
    );
}
