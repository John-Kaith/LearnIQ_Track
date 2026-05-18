import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import type { AttendanceLogEntry, AttendanceLogStatus } from '@/data/studentImmersionMock';

const STATUS_STYLES: Record<
  AttendanceLogStatus,
  { label: string; bg: string; color: string }
> = {
  completed: { label: 'Completed', bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' },
  incomplete: { label: 'Incomplete', bg: 'rgba(248, 113, 113, 0.15)', color: '#f87171' },
  partial: { label: 'Partial', bg: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' },
};

export function AttendanceLogCard({
  log,
  onPress,
}: {
  log: AttendanceLogEntry;
  onPress?: () => void;
}) {
  const badge = STATUS_STYLES[log.status];

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
        <View style={styles.locationRow}>
          <Feather name="map-pin" size={11} color={Colors.textMuted} />
          <Text style={styles.location} numberOfLines={1}>
            {log.location}
          </Text>
        </View>
      </View>
      <View style={styles.right}>
        <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
        </View>
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
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    color: Colors.textMuted,
    fontSize: 11,
    flex: 1,
  },
  right: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  hours: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
