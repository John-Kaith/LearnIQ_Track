import { Tabs } from 'expo-router';

import { Colors } from '@/constants/colors';

export default function TeacherTabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.backgroundSoft,
          borderTopColor: Colors.border,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
      <Tabs.Screen name="dashboard" options={{ title: '🏠 Dashboard' }} />
      <Tabs.Screen name="subjects" options={{ title: '📚 Subjects' }} />
      <Tabs.Screen name="immersion" options={{ title: '📍 Immersion' }} />
      <Tabs.Screen name="profile" options={{ title: '👤 Profile' }} />
    </Tabs>
  );
}
