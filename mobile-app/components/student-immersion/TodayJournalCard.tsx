import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccentFill, accentShadow } from '@/components/ui/AccentFill';
import { Colors } from '@/constants/colors';
import { WebTheme } from '@/constants/learniqTheme';

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
        <AccentFill radius={10} />
        <Text style={styles.btnText}>Write Journal</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
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
    borderColor: 'transparent',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: WebTheme.accentSolid,
    ...accentShadow,
  },
  pressed: { opacity: 0.88 },
  btnText: {
    color: WebTheme.onAccent,
    fontSize: 14,
    fontWeight: '700',
  },
});
// .
