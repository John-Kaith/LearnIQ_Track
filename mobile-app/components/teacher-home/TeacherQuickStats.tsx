import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { AccentFill, accentShadow } from '@/components/ui/AccentFill';
import { Colors } from '@/constants/colors';
import { WebTheme } from '@/constants/learniqTheme';

type Stat = {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
};

export function TeacherQuickStats({ items }: { items: Stat[] }) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.label} style={styles.card}>
          {/* Gold tile with a white icon, like the website's .metric-icon */}
          <View style={styles.iconWrap}>
            <AccentFill radius={10} />
            <Ionicons name={item.icon} size={18} color={WebTheme.onAccent} />
          </View>
          <Text style={styles.value}>{item.value}</Text>
          <Text style={styles.label} numberOfLines={2}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 22,
  },
  card: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
    gap: 6,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    backgroundColor: WebTheme.accentSolid,
    ...accentShadow,
  },
  value: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  label: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 14,
  },
});
// .
