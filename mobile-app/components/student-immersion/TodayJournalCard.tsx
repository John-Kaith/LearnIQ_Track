import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

export function TodayJournalCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Today&apos;s Journal</Text>
      <Text style={styles.body}>You haven&apos;t written your journal for today.</Text>
      <Text style={styles.sub}>Share your tasks, learnings and experiences.</Text>
      <Pressable
        onPress={() => Alert.alert('Journal', 'Write journal — coming soon (mock).')}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
        <Text style={styles.btnText}>Write Journal</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginBottom: 16,
  },
  title: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  body: {
    color: Colors.text,
    fontSize: 14,
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
    borderColor: 'rgba(96, 165, 250, 0.45)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  pressed: { opacity: 0.88 },
  btnText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
