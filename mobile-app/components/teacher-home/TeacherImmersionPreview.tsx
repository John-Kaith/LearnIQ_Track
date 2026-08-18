import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

type Props = {
  activeStudents: number;
  pendingJournals: number;
  onOpenMonitoring: () => void;
};

export function TeacherImmersionPreview({ activeStudents, pendingJournals, onOpenMonitoring }: Props) {
  return (
    <Pressable
      onPress={onOpenMonitoring}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.value}>{activeStudents}</Text>
          <Text style={styles.label}>Active Now</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.value}>{pendingJournals}</Text>
          <Text style={styles.label}>Pending Journals</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Open Immersion Monitoring</Text>
        <Feather name="chevron-right" size={16} color={Colors.primary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 22,
  },
  pressed: { opacity: 0.92 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },
  value: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  label: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  footerText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
