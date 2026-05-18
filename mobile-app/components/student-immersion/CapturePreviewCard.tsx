import { Feather } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import type { AttendanceCapture } from '@/types/immersion';
import { formatDisplayTime } from '@/services/immersion';

type Props = {
  capture: AttendanceCapture;
  badge: string;
};

export function CapturePreviewCard({ capture, badge }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.previewRow}>
        <Image source={{ uri: capture.photoUri }} style={styles.thumb} />
        <View style={styles.previewMeta}>
          <Text style={styles.badge}>{badge}</Text>
          <Text style={styles.hint}>Live capture — gallery uploads are not allowed.</Text>
        </View>
      </View>

      <View style={styles.fields}>
        <View style={styles.field}>
          <Feather name="map-pin" size={14} color={Colors.primary} />
          <View style={styles.fieldText}>
            <Text style={styles.fieldLabel}>Location</Text>
            <Text style={styles.fieldValue}>{capture.readableLocationName}</Text>
          </View>
        </View>
        <View style={styles.field}>
          <Feather name="clock" size={14} color={Colors.primary} />
          <View style={styles.fieldText}>
            <Text style={styles.fieldLabel}>Time</Text>
            <Text style={styles.fieldValue}>
              {formatDisplayTime(capture.captureTimestamp)}
            </Text>
          </View>
        </View>
        <View style={styles.field}>
          <Feather name="crosshair" size={14} color={Colors.primary} />
          <View style={styles.fieldText}>
            <Text style={styles.fieldLabel}>Coordinates</Text>
            <Text style={styles.fieldValue}>
              {capture.latitude.toFixed(3)}, {capture.longitude.toFixed(3)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 14,
    gap: 12,
  },
  previewRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: Colors.backgroundSoft,
  },
  previewMeta: { flex: 1, minWidth: 0 },
  badge: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  fields: { gap: 10 },
  field: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  fieldText: { flex: 1 },
  fieldLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fieldValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
