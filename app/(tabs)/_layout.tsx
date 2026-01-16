import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@react-navigation/native';

export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{

        headerShown: false,
        tabBarButton: HapticTab,

      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarActiveTintColor: '#6366F1',
          tabBarIcon: ({ focused }) => <IconSymbol size={28} name='house.fill' color={focused ? '#6366F1' : '#9ca3af'} />,
        }}
      />

      <Tabs.Screen
        name="Notes"
        options={{
          title: 'Notes',
          tabBarActiveTintColor: '#305ff9ff',
          tabBarIcon: ({ focused }) => <IconSymbol size={28} name='note.text' color={focused ? '#305ff9ff' : '#9ca3af'} />,
        }}
      />

      <Tabs.Screen
        name="Tasks"
        options={{
          title: 'Tasks',
          tabBarActiveTintColor: 'lime',
          tabBarIcon: ({ focused }) => <IconSymbol size={28} name='checkmark.circle' color={focused ? 'lime' : '#9ca3af'} />,
        }}
      />
    </Tabs>
  );
}
