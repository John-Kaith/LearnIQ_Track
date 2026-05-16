import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

type QuickItem = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

export function QuickAccessGrid({ items }: { items: QuickItem[] }) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
          <View style={[styles.iconWrap, { backgroundColor: `${item.color}20` }]}>
            <Ionicons name={item.icon} size={24} color={item.color} />
          </View>
          <Text style={styles.label} numberOfLines={2}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 22,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 10,
  },
  pressed: { opacity: 0.88 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
});
