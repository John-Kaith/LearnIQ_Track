import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import type { AttendanceLogEntry } from '@/data/studentImmersionMock';

export function AttendanceLogCard({
  log,
  onPress,
}: {
  log: AttendanceLogEntry;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.dateBadge}>
        <Text style={styles.month}>{log.month}</Text>
        <Text style={styles.day}>{log.day}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.dateLabel}>{log.dateLabel}</Text>
        <Text style={styles.times}>
          Time In: {log.timeIn} • Time Out: {log.timeOut}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.hours}>{log.totalHours.toFixed(1)} hrs</Text>
        <Feather name="chevron-right" size={18} color={Colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  pressed: { opacity: 0.92 },
  dateBadge: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  month: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  day: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  content: { flex: 1, minWidth: 0 },
  dateLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  times: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  hours: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
