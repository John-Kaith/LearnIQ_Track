import { Feather } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AccentFill, accentShadow } from '@/components/ui/AccentFill';
import { Colors } from '@/constants/colors';
import { WebTheme } from '@/constants/learniqTheme';
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
          <Feather name="bookmark" size={12} color={WebTheme.softText} />
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
          <AccentFill radius={10} />
          <Text style={styles.openBtnText}>Open Subject</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
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
    backgroundColor: WebTheme.pillBg,
    borderWidth: 1,
    borderColor: WebTheme.pillBorder,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    color: WebTheme.softText,
    fontSize: 11,
    fontWeight: '700',
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
    borderColor: 'transparent',
    backgroundColor: WebTheme.accentSolid,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...accentShadow,
  },
  openBtnPressed: { opacity: 0.88 },
  openBtnText: {
    color: WebTheme.onAccent,
    fontSize: 13,
    fontWeight: '700',
  },
});
// .
