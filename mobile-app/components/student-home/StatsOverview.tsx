import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

type StatItem = {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  color: string;
};

export function StatsOverview({ items }: { items: StatItem[] }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {items.map((item) => (
          <View key={item.label} style={styles.item}>
            <View style={[styles.iconWrap, { backgroundColor: `${item.color}22` }]}>
              <Ionicons name={item.icon} size={22} color={item.color} />
            </View>
            <Text style={styles.value}>{item.value}</Text>
            <Text style={styles.label}>{item.label}</Text>
          </View>
        ))}
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
    paddingVertical: 18,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  value: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  label: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
});
