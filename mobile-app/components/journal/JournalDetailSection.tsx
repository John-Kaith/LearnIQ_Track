import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

export function JournalDetailSection({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{content || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  body: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
});
