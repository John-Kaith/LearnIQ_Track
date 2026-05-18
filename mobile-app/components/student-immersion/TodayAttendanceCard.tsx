import { Feather, Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { CapturePreviewCard } from '@/components/student-immersion/CapturePreviewCard';
import { Colors } from '@/constants/colors';
import type { AttendanceCapture, AttendanceRecord, CaptureMode } from '@/types/immersion';

type Props = {
  todayDate: string;
  statusLabel: string;
  timeIn: AttendanceRecord | null;
  timeOut: AttendanceRecord | null;
  totalHours: number;
  durationLabel: string;
  captureMode: CaptureMode;
  pendingCapture: AttendanceCapture | null;
  captureStatus: string;
  isCapturing: boolean;
  canTimeIn: boolean;
  canTimeOut: boolean;
  onTakePhoto: () => void;
  onTimeIn: () => void;
  onTimeOut: () => void;
};

export function TodayAttendanceCard({
  todayDate,
  statusLabel,
  timeIn,
  timeOut,
  totalHours,
  durationLabel,
  captureMode,
  pendingCapture,
  captureStatus,
  isCapturing,
  canTimeIn,
  canTimeOut,
  onTakePhoto,
  onTimeIn,
  onTimeOut,
}: Props) {
  const previewBadge =
    captureMode === 'time_in' ? 'Photo Preview' : 'Time Out Photo Preview';

  const sessionComplete = statusLabel === 'Completed';

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
          <Text style={styles.cellLabel}>Current Status</Text>
          <Text style={styles.cellValue} numberOfLines={2}>
            {statusLabel}
          </Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>Time In</Text>
          <Text style={styles.cellValue}>{timeIn?.displayTime ?? '--:-- AM'}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>Time Out</Text>
          <Text style={styles.cellValue}>{timeOut?.displayTime ?? '--:-- PM'}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.cellLabel}>Duration</Text>
          <Text style={styles.cellValue} numberOfLines={1}>
            {sessionComplete && totalHours > 0
              ? `${totalHours.toFixed(1)} hrs`
              : durationLabel}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onTakePhoto}
        disabled={isCapturing || sessionComplete || Boolean(pendingCapture)}
        style={({ pressed }) => [
          styles.cameraBtn,
          (isCapturing || sessionComplete || pendingCapture) && styles.cameraBtnDisabled,
          pressed &&
            !isCapturing &&
            !sessionComplete &&
            !pendingCapture &&
            styles.pressed,
        ]}>
        {isCapturing ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name="camera" size={22} color="#fff" />
        )}
        <Text style={styles.cameraBtnText}>
          {isCapturing ? 'Capturing…' : 'Take Photo'}
        </Text>
      </Pressable>

      <Text
        style={[
          styles.captureStatus,
          captureStatus.toLowerCase().includes('permission') && styles.captureStatusError,
        ]}>
        {captureStatus}
      </Text>

      {pendingCapture ? (
        <CapturePreviewCard capture={pendingCapture} badge={previewBadge} />
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={onTimeIn}
          disabled={!canTimeIn}
          style={({ pressed }) => [
            styles.btnIn,
            !canTimeIn && styles.btnLocked,
            pressed && canTimeIn && styles.pressed,
          ]}>
          <Ionicons name="log-in-outline" size={20} color="#fff" />
          <Text style={styles.btnText}>Time In</Text>
        </Pressable>
        <Pressable
          onPress={onTimeOut}
          disabled={!canTimeOut}
          style={({ pressed }) => [
            styles.btnOut,
            !canTimeOut && styles.btnLocked,
            pressed && canTimeOut && styles.pressed,
          ]}>
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
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  cell: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    minWidth: '46%',
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
  },
  cameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.45)',
  },
  cameraBtnDisabled: {
    opacity: 0.55,
  },
  cameraBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  captureStatus: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  captureStatusError: {
    color: '#f87171',
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
  btnLocked: {
    opacity: 0.45,
  },
  pressed: { opacity: 0.9 },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
