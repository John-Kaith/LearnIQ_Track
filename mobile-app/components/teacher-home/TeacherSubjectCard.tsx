import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import type { TeacherSubjectItem } from '@/data/teacherHomeMock';

type Props = {
  subject: TeacherSubjectItem;
  onOpen: () => void;
  onPublish: () => void;
};

export function TeacherSubjectCard({ subject, onOpen, onPublish }: Props) {
  const studentLabel = subject.studentCount === 1 ? '1 student' : `${subject.studentCount} students`;

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.topRow}>
        <View style={styles.titleCol}>
          <Text style={styles.title}>{subject.name}</Text>
          <Text style={styles.meta}>{studentLabel}</Text>
        </View>
        <Feather name="chevron-right" size={20} color={Colors.textMuted} />
      </View>

      <Pressable
        onPress={onPublish}
        hitSlop={8}
        style={({ pressed }) => [styles.publishBtn, pressed && styles.publishBtnPressed]}>
        <Feather name="upload-cloud" size={13} color="#93c5fd" />
        <Text style={styles.publishText}>Publish Lesson</Text>
      </Pressable>
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
    marginBottom: 12,
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
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.4)',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  publishBtnPressed: { opacity: 0.88 },
  publishText: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
  },
});
