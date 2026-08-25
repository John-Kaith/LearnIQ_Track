import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

export function TodayJournalCard() {
  const router = useRouter();

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Today&apos;s Journal</Text>
      <Text style={styles.body}>You haven&apos;t written your journal for today.</Text>
      <Text style={styles.sub}>Share your tasks, learnings and experiences.</Text>
      <Pressable
        onPress={() => router.push('/journal/create')}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
        <Text style={styles.btnText}>Write Journal</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 16,
    opacity: 0.92,
  },
  title: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  body: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 6,
  },
  sub: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  btn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(202, 138, 4, 0.45)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(161, 98, 7, 0.12)',
  },
  pressed: { opacity: 0.88 },
  btnText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
