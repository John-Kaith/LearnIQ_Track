import { Feather, Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

type Props = {
  todayDate: string;
  timeIn: string | null;
  timeOut: string | null;
  totalHours: number;
  timeInStatus: string;
  timeOutStatus: string;
  onTimeIn: () => void;
  onTimeOut: () => void;
};

export function TodayAttendanceCard({
  todayDate,
  timeIn,
  timeOut,
  totalHours,
  timeInStatus,
  timeOutStatus,
  onTimeIn,
  onTimeOut,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Today&apos;s Attendance</Text>
        <View style={styles.dateRow}>
          <Feather name="calendar" size={14} color={Colors.textMuted} />
          <Text style={styles.date}>{todayDate}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>Time In</Text>
          <Text style={styles.cellValue}>{timeIn ?? '--:-- AM'}</Text>
          <Text style={styles.status}>{timeInStatus}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>Time Out</Text>
          <Text style={styles.cellValue}>{timeOut ?? '--:-- PM'}</Text>
          <Text style={styles.status}>{timeOutStatus}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>Total Hours</Text>
          <Text style={styles.cellValue}>{totalHours.toFixed(1)} hrs</Text>
          <Text style={styles.status}>—</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onTimeIn}
          style={({ pressed }) => [styles.btnIn, pressed && styles.pressed]}>
          <Ionicons name="log-in-outline" size={20} color="#fff" />
          <Text style={styles.btnText}>Time In</Text>
        </Pressable>
        <Pressable
          onPress={onTimeOut}
          style={({ pressed }) => [styles.btnOut, pressed && styles.pressed]}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.btnText}>Time Out</Text>
        </Pressable>
      </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  title: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  date: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  cell: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
  },
  cellLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    marginBottom: 4,
  },
  cellValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  status: {
    color: Colors.textMuted,
    fontSize: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  btnIn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.4)',
  },
  btnOut: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.45)',
  },
  pressed: { opacity: 0.9 },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
