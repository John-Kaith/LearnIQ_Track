import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.text,
    border: Colors.border,
    primary: Colors.primary,
  },
};

/** Back to the login screen whenever the session ends (logout, or a refresh the server refused). */
function useSignedOutRedirect() {
  const router = useRouter();
  const segments = useSegments();
  const user = useAuthStore((s) => s.user);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const top = segments[0];

  useEffect(() => {
    // The index route already sends signed-out users to the login screen.
    if (isHydrating || user || !top || top === '(auth)') return;
    router.replace('/(auth)/login');
  }, [isHydrating, user, top, router]);
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useSignedOutRedirect();

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
          <Stack.Screen name="teacher-subject/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="lesson/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="reviewer/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="quiz/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="activities/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="journal/create" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="journal/history" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="journal/[id]" options={{ animation: 'slide_from_right' }} />
          {/* Arcade games: no swipe-back, a match in progress would be lost. */}
          <Stack.Screen name="play/[game]" options={{ animation: 'fade', gestureEnabled: false }} />
        </Stack>
        <StatusBar style="dark" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
// .
