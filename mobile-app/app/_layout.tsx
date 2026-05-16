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

/**
 * Root navigation — single entry today.
 * Future: add (auth), (student-tabs), (teacher-tabs) as Stack screens here.
 */
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
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
    </SafeAreaProvider>
  );
}
