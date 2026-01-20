import Sidebar from '@/components/navigation/sidebar';
import { Drawer } from 'expo-router/drawer';
import React from 'react';

export default function DrawerLayout() {
  return (
    <Drawer
      screenOptions={{
        headerShown: true,
        drawerType: 'slide',
        drawerStyle: {
          width: '80%',
          maxWidth: 320,
        },
      }}
      drawerContent={(props) => <Sidebar {...props} />}
    >
      <Drawer.Screen
        name="index"
        options={{
          title: 'Home',
          drawerLabel: 'Home',
          headerShown: false,
        }}
      />

      <Drawer.Screen
        name="Notes"
        options={{
          title: 'Notes',
          drawerLabel: 'Notes',
          headerShown: false,
        }}
      />

      <Drawer.Screen
        name="Tasks"
        options={{
          title: 'Tasks',
          drawerLabel: 'Tasks',
          headerShown: false,
        }}
      />
    </Drawer>
  );
}
