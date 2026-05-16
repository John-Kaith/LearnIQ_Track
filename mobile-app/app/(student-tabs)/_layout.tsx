import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StudentTabIcon } from '@/components/navigation/StudentTabIcon';

const TAB_ACTIVE = '#4F8CFF';
const TAB_INACTIVE = '#7B8BA8';
const TAB_CONTENT_HEIGHT = 56;

export default function StudentTabLayout() {
  const insets = useSafeAreaInsets();
  // Gesture nav → insets.bottom ~0, sit near bottom. 3-button nav → lifts above system bar.
  const bottomPad = insets.bottom > 0 ? insets.bottom : 8;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
        tabBarStyle: {
          ...styles.bar,
          height: TAB_CONTENT_HEIGHT + bottomPad,
          paddingBottom: bottomPad,
        },
        tabBarHideOnKeyboard: true,
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <StudentTabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Learn',
          tabBarIcon: ({ focused }) => <StudentTabIcon name="learn" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="immersion"
        options={{
          title: 'Immersion',
          tabBarIcon: ({ focused }) => <StudentTabIcon name="immersion" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <StudentTabIcon name="profile" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: 'rgba(8, 14, 28, 0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.14)',
    paddingTop: 8,
    paddingHorizontal: 4,
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  item: {
    paddingTop: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
});
