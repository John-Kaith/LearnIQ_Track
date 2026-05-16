import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

type Props = {
  company: string;
  supervisor: string;
  requiredHours: number;
};

export function ImmersionInfoCard({ company, supervisor, requiredHours }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Immersion Information</Text>
      <InfoRow label="Company / Establishment" value={company} />
      <InfoRow label="Supervisor" value={supervisor} />
      <InfoRow label="Required Hours" value={`${requiredHours} hrs`} />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
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
    marginBottom: 8,
  },
  title: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  label: {
    color: Colors.textMuted,
    fontSize: 13,
    flex: 1,
  },
  value: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
});
