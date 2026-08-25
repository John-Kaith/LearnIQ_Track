import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

type Props = {
  completedHours: number;
  requiredHours: number;
  remainingHours: number;
  percentComplete: number;
};

export function ImmersionProgressCard({
  completedHours,
  requiredHours,
  remainingHours,
  percentComplete,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Immersion Progress</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Hours Completed</Text>
          <Text style={styles.statValue}>
            <Text style={styles.highlight}>{completedHours}</Text>
            <Text style={styles.muted}> / {requiredHours} hrs</Text>
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Remaining Hours</Text>
          <Text style={[styles.statValue, styles.highlight]}>{remainingHours} hrs</Text>
        </View>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percentComplete}%` }]} />
      </View>
      <Text style={styles.percent}>{percentComplete}% Completed</Text>
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
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  stat: { flex: 1 },
  statLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  statValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  highlight: { color: Colors.primary },
  muted: { color: Colors.textMuted, fontWeight: '500' },
  track: {
    height: 8,
    backgroundColor: 'rgba(120, 53, 15, 0.12)',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  fill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  percent: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
