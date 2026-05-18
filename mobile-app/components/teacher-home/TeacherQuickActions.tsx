import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import type { TeacherQuickAction } from '@/data/teacherHomeMock';

type Props = {
  items: TeacherQuickAction[];
  onPress: (id: string, label: string) => void;
};

export function TeacherQuickActions({ items, onPress }: Props) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => onPress(item.id, item.label)}
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
          <View style={[styles.iconWrap, { backgroundColor: `${item.color}18` }]}>
            <Ionicons name={item.icon} size={20} color={item.color} />
          </View>
          <Text style={styles.label}>{item.label}</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
    marginBottom: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  pressed: { opacity: 0.88 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
});
