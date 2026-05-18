import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import type { LessonSummary } from '@/data/studentLearnFlowMock';

export function LessonListCard({
  lesson,
  onPress,
}: {
  lesson: LessonSummary;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.number}>
        <Text style={styles.numberText}>{lesson.number}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.label}>Lesson {lesson.number}</Text>
        <Text style={styles.title}>{lesson.title}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  pressed: { opacity: 0.92 },
  number: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  content: { flex: 1, minWidth: 0 },
  label: {
    color: Colors.textMuted,
    fontSize: 11,
    marginBottom: 2,
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
