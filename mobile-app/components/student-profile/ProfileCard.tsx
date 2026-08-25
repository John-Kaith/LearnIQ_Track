import { Feather, Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

type ProfileCardProps = {
  initials: string;
  fullName: string;
  roleAcademic: string;
  idNumber: string;
  /** Omit when there's no real approval-status concept to report (e.g. students). */
  approvalStatus?: 'approved' | 'pending' | 'rejected';
  section: string;
  strand: string;
  adviser: string;
  memberSince: string;
};

export function ProfileCard({
  initials,
  fullName,
  roleAcademic,
  idNumber,
  approvalStatus,
  section,
  strand,
  adviser,
  memberSince,
}: ProfileCardProps) {
  const badge =
    approvalStatus === 'approved'
      ? { label: 'Approved', color: '#22c55e' }
      : approvalStatus === 'pending'
        ? { label: 'Pending', color: '#f59e0b' }
        : approvalStatus === 'rejected'
          ? { label: 'Rejected', color: '#ef4444' }
          : null;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatarGlow}>
            <View style={styles.avatar}>
              <Text style={styles.initials}>{initials}</Text>
            </View>
          </View>
          <Pressable
            style={styles.cameraBtn}
            onPress={() => Alert.alert('Photo', 'Change profile photo — coming soon (mock).')}>
            <Feather name="camera" size={12} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.main}>
          <Text style={styles.name}>{fullName}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="school-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.meta}>{roleAcademic}</Text>
          </View>
          <View style={styles.metaRow}>
            <Feather name="credit-card" size={13} color={Colors.textMuted} />
            <Text style={styles.meta}>ID: {idNumber}</Text>
          </View>
          {badge ? (
            <View style={[styles.badge, { borderColor: `${badge.color}44` }]}>
              <Feather name="check-circle" size={12} color={badge.color} />
              <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={() => Alert.alert('Edit Profile', 'Profile editor — coming soon (mock).')}
          style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}>
          <Feather name="edit-2" size={14} color={Colors.primary} />
          <Text style={styles.editText}>Edit Profile</Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

      <View style={styles.infoRow}>
        <InfoCell icon="users" label="Section" value={section} />
        <InfoCell icon="bookmark" label="Strand" value={strand} />
        <InfoCell icon="user" label="Adviser" value={adviser} />
        <InfoCell icon="calendar" label="Member Since" value={memberSince} isLast />
      </View>
    </View>
  );
}

function InfoCell({
  icon,
  label,
  value,
  isLast,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.infoCell, !isLast && styles.infoCellDivider]}>
      <Feather name={icon} size={15} color={Colors.textMuted} />
      <Text style={styles.infoLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 24,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarGlow: {
    padding: 2,
    borderRadius: 40,
    backgroundColor: 'rgba(202, 138, 4, 0.3)',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: 'rgba(234, 179, 8, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  cameraBtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#eab308',
    borderWidth: 2,
    borderColor: Colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
  },
  name: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  meta: {
    color: Colors.textMuted,
    fontSize: 12,
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  editBtn: {
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(202, 138, 4, 0.4)',
    backgroundColor: 'rgba(161, 98, 7, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  editText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  pressed: { opacity: 0.88 },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  infoCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 5,
  },
  infoCellDivider: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(120, 53, 15, 0.14)',
  },
  infoLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  infoValue: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
  },
});
