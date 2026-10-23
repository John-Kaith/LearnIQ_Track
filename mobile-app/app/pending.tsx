import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/colors';
import { WebTheme } from '@/constants/learniqTheme';
import { WebBackground } from '@/components/ui/WebBackground';
import { AccentFill, accentShadow } from '@/components/ui/AccentFill';

export default function PendingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}>
      <WebBackground />
      <View style={styles.mark}>
        <AccentFill radius={14} />
        <Text style={styles.markText}>LQ</Text>
      </View>
      <Text style={styles.message}>
        Your account is pending administrator approval.
      </Text>
      <Pressable onPress={() => router.replace('/(auth)/login')} style={styles.link}>
        <Text style={styles.linkText}>Back to sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: WebTheme.accentSolid,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'transparent',
    ...accentShadow,
  },
  markText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  message: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 26,
  },
  link: {
    marginTop: 28,
  },
  linkText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});
// .
