import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import type { TeacherSubject } from '@/services/subjects';

type Props = {
  subject: TeacherSubject;
  onPress: () => void;
};

export function TeacherSubjectListCard({ subject, onPress }: Props) {
  const lessonLabel =
    subject.totalLessonCount === 0
      ? 'No lessons yet'
      : `${subject.publishedLessonCount} published · ${subject.totalLessonCount} total`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.colorDot, { backgroundColor: subject.color || Colors.primary }]} />
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={1}>
          {subject.name}
        </Text>
        {!!subject.description && (
          <Text style={styles.description} numberOfLines={1}>
            {subject.description}
          </Text>
        )}
        <Text style={styles.meta}>{lessonLabel}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
  },
  pressed: { opacity: 0.92 },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  textCol: { flex: 1, minWidth: 0 },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  description: {
    color: Colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  meta: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
