import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Colors } from '@/constants/colors';

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.background,
    card: Colors.backgroundSoft,
    text: Colors.text,
    border: Colors.border,
    primary: Colors.primary,
  },
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
          }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(student-tabs)" />
          <Stack.Screen name="(teacher-tabs)" />
          <Stack.Screen name="pending" />
          <Stack.Screen name="subject/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="lesson/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="reviewer/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="quiz/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="activities/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="journal/create" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="journal/history" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="journal/[id]" options={{ animation: 'slide_from_right' }} />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
