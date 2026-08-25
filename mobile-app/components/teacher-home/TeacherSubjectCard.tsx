import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import type { TeacherSubject } from '@/services/subjects';

type Props = {
  subject: TeacherSubject;
  onOpen: () => void;
};

export function TeacherSubjectCard({ subject, onOpen }: Props) {
  const lessonLabel =
    subject.publishedLessonCount === 1
      ? '1 published lesson'
      : `${subject.publishedLessonCount} published lessons`;

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.topRow}>
        <View style={styles.titleCol}>
          <Text style={styles.title}>{subject.name}</Text>
          <Text style={styles.meta}>{lessonLabel}</Text>
        </View>
        <Feather name="chevron-right" size={20} color={Colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
  },
  pressed: { opacity: 0.92 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleCol: { flex: 1, minWidth: 0 },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  meta: {
    color: Colors.textMuted,
    fontSize: 13,
  },
});
