import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import type { TeacherLessonSummary } from '@/services/subjects';

export function TeacherLessonRow({ lesson }: { lesson: TeacherLessonSummary }) {
  return (
    <View style={styles.row}>
      <View style={styles.iconBox}>
        <Feather name="file-text" size={16} color={Colors.primary} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {lesson.title}
        </Text>
        <Text style={styles.meta}>{lesson.fileType || 'FILE'}</Text>
      </View>
      <View style={[styles.badge, lesson.published ? styles.badgePublished : styles.badgeDraft]}>
        <Text style={[styles.badgeText, lesson.published ? styles.badgeTextPublished : styles.badgeTextDraft]}>
          {lesson.published ? 'Published' : 'Draft'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(161, 98, 7, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, minWidth: 0 },
  title: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  meta: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgePublished: {
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
  },
  badgeDraft: {
    backgroundColor: 'rgba(120, 113, 108, 0.14)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextPublished: {
    color: '#15803d',
  },
  badgeTextDraft: {
    color: Colors.textMuted,
  },
});
