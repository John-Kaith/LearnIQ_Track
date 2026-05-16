import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

type LeaderboardPreviewCardProps = {
  label: string;
  xp: string;
};

export function LeaderboardPreviewCard({ label, xp }: LeaderboardPreviewCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name="trophy" size={22} color="#facc15" />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.xp}>{xp}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(250, 204, 21, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  xp: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});
