import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { WebTheme } from '@/constants/learniqTheme';
import type { JournalEntry } from '@/data/studentJournalMock';

export function JournalHistoryCard({
  entry,
  onPress,
}: {
  entry: JournalEntry;
  onPress: () => void;
}) {
  const isSubmitted = entry.status === 'submitted';

  return (
    <Pressable
      onPress={onPress}
      disabled={!isSubmitted}
      style={({ pressed }) => [
        styles.card,
        pressed && isSubmitted && styles.pressed,
        !isSubmitted && styles.cardMuted,
      ]}>
      <View style={styles.flex}>
        <Text style={styles.date}>{entry.dateLabel}</Text>
        <View
          style={[
            styles.badge,
            isSubmitted ? styles.badgeSubmitted : styles.badgeMissing,
          ]}>
          <Text
            style={[
              styles.badgeText,
              isSubmitted ? styles.badgeTextSubmitted : styles.badgeTextMissing,
            ]}>
            {isSubmitted ? 'Submitted' : 'Missing'}
          </Text>
        </View>
      </View>
      {isSubmitted ? (
        <Feather name="chevron-right" size={20} color={Colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
    marginBottom: 10,
    gap: 12,
  },
  cardMuted: { opacity: 0.75 },
  pressed: { opacity: 0.92 },
  flex: { flex: 1, gap: 8 },
  date: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeSubmitted: {
    backgroundColor: WebTheme.successBg,
    borderColor: 'rgba(22, 101, 52, 0.3)',
  },
  badgeMissing: {
    backgroundColor: 'rgba(120, 53, 15, 0.08)',
    borderColor: Colors.border,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextSubmitted: { color: WebTheme.success },
  badgeTextMissing: { color: Colors.textMuted },
});
// .
