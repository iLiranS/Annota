import { Drawer } from 'expo-router/drawer';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { IconSymbol } from '@/components/ui/icon-symbol';

export default function DrawerLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        screenOptions={{
          headerShown: true,
          drawerType: 'slide',
        }}
      >
        <Drawer.Screen
          name="index"
          options={{
            title: 'Home',
            drawerLabel: 'Home',
            drawerIcon: ({ focused, size }) => (
              <IconSymbol size={size} name="house.fill" color={focused ? '#6366F1' : '#9ca3af'} />
            ),
          }}
        />

        <Drawer.Screen
          name="Notes"
          options={{
            title: 'Notes',
            drawerLabel: 'Notes',
            headerShown: false,
            drawerIcon: ({ focused, size }) => (
              <IconSymbol size={size} name="note.text" color={focused ? '#305ff9ff' : '#9ca3af'} />
            ),
          }}
        />

        <Drawer.Screen
          name="Tasks"
          options={{
            title: 'Tasks',
            drawerLabel: 'Tasks',
            headerShown: false,
            drawerIcon: ({ focused, size }) => (
              <IconSymbol size={size} name="checkmark.circle" color={focused ? 'lime' : '#9ca3af'} />
            ),
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
