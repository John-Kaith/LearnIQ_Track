import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

type UpcomingImmersionCardProps = {
  timeIn: string;
  timeOut: string;
};

export function UpcomingImmersionCard({ timeIn, timeOut }: UpcomingImmersionCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.times}>
        <View style={styles.timeRow}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(234, 179, 8, 0.2)' }]}>
            <Ionicons name="log-in-outline" size={18} color="#fbbf24" />
          </View>
          <View>
            <Text style={styles.timeLabel}>Time In</Text>
            <Text style={styles.timeValue}>{timeIn}</Text>
          </View>
        </View>
        <View style={styles.timeRow}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(248, 113, 113, 0.15)' }]}>
            <Ionicons name="log-out-outline" size={18} color="#f87171" />
          </View>
          <View>
            <Text style={styles.timeLabel}>Time Out</Text>
            <Text style={styles.timeValue}>{timeOut}</Text>
          </View>
        </View>
      </View>
      <Pressable style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}>
        <Ionicons name="location" size={16} color={Colors.primary} />
        <Text style={styles.btnText}>View Details</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 22,
    gap: 12,
  },
  times: {
    flex: 1,
    gap: 14,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    marginBottom: 2,
  },
  timeValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(120, 53, 15, 0.06)',
    gap: 6,
    minWidth: 88,
  },
  btnPressed: { opacity: 0.85 },
  btnText: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
