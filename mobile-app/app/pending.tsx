import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/colors';

export default function PendingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}>
      <View style={styles.mark}>
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
    backgroundColor: '#a16207',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.45)',
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
