import { Feather } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import type { StudentSubject } from '@/data/studentLearnMock';

export function SubjectCard({
  subject,
  onOpen,
}: {
  subject: StudentSubject;
  onOpen?: () => void;
}) {
  const lessonLabel = subject.lessonCount === 1 ? '1 lesson' : `${subject.lessonCount} lessons`;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.titleCol}>
          <Text style={styles.title}>{subject.title}</Text>
          <Text style={styles.lessons}>{lessonLabel}</Text>
        </View>
        <View style={styles.badge}>
          <Feather name="bookmark" size={12} color="#fbbf24" />
          <Text style={styles.badgeText}>Subject</Text>
        </View>
      </View>

      <Text style={styles.description}>Lessons grouped under this subject.</Text>

      <View style={styles.footer}>
        <Text style={styles.meta}>Reviewer • Quiz • Activities</Text>
        <Pressable
          onPress={
            onOpen ??
            (() => Alert.alert('Open Subject', `Mock open: ${subject.title}`))
          }
          style={({ pressed }) => [styles.openBtn, pressed && styles.openBtnPressed]}>
          <Text style={styles.openBtnText}>Open Subject</Text>
        </Pressable>
      </View>
    </View>
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  lessons: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '600',
  },
  description: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  meta: {
    color: Colors.textMuted,
    fontSize: 12,
    flex: 1,
    minWidth: 120,
  },
  openBtn: {
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.5)',
    backgroundColor: 'rgba(161, 98, 7, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  openBtnPressed: { opacity: 0.88 },
  openBtnText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '700',
  },
});
