import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

export function MySubjectsHeader({ onRefresh }: { onRefresh: () => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>My Subjects</Text>
      <Pressable onPress={onRefresh} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
        <Feather name="refresh-cw" size={14} color={Colors.text} />
        <Text style={styles.btnText}>Refresh</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pressed: { opacity: 0.85 },
  btnText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
