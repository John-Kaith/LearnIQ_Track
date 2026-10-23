import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { AccentFill, accentShadow } from '@/components/ui/AccentFill';
import { Colors } from '@/constants/colors';
import { WebTheme } from '@/constants/learniqTheme';

type StatItem = {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
};

export function StatsOverview({ items }: { items: StatItem[] }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {items.map((item) => (
          <View key={item.label} style={styles.item}>
            {/* Gold tile with a white icon, like the website's .metric-icon */}
            <View style={styles.iconWrap}>
              <AccentFill radius={14} />
              <Ionicons name={item.icon} size={22} color={WebTheme.onAccent} />
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
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
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
    backgroundColor: WebTheme.accentSolid,
    ...accentShadow,
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
// .
