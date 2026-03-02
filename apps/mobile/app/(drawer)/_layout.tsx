import Sidebar from '@/components/navigation/sidebar';
import { Drawer } from 'expo-router/drawer';
import React from 'react';
import { useWindowDimensions } from 'react-native';

export default function DrawerLayout() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const drawerWidth = isLargeScreen ? 280 : Math.min(width * 0.8, 300);

  return (
    <Drawer
      screenOptions={{
        headerShown: true,
        drawerType: 'slide',
        drawerStyle: {
          width: drawerWidth,
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
