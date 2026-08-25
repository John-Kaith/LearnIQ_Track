import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TeacherLessonRow } from '@/components/teacher-subject/TeacherLessonRow';
import { StackHeader } from '@/components/navigation/StackHeader';
import { Colors } from '@/constants/colors';
import {
  fetchTeacherLessonsForSubject,
  fetchTeacherSubjectById,
  type TeacherLessonSummary,
  type TeacherSubject,
} from '@/services/subjects';

export default function TeacherSubjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [subject, setSubject] = useState<TeacherSubject | null>(null);
  const [lessons, setLessons] = useState<TeacherLessonSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [subj, lessonRows] = await Promise.all([
          fetchTeacherSubjectById(id),
          fetchTeacherLessonsForSubject(id),
        ]);
        if (cancelled) return;
        setSubject(subj);
        setLessons(lessonRows);
      } catch (e) {
        if (!cancelled) {
          Alert.alert('Could not load subject', e instanceof Error ? e.message : 'Please try again.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <View style={styles.root}>
      <StackHeader title={subject?.name ?? 'Subject'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={styles.loading} />
        ) : (
          <>
            {!!subject?.description && <Text style={styles.description}>{subject.description}</Text>}

            {subject?.joinCode && (
              <View style={styles.joinCodeCard}>
                <Text style={styles.joinCodeLabel}>Students join with</Text>
                <Text style={styles.joinCode}>{subject.joinCode}</Text>
              </View>
            )}

            {/* Class Attendance card goes here — next build step. */}

            <Text style={styles.sectionTitle}>Lessons</Text>
            {lessons.length === 0 ? (
              <Text style={styles.empty}>No lessons uploaded yet.</Text>
            ) : (
              lessons.map((lesson) => <TeacherLessonRow key={lesson.id} lesson={lesson} />)
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  loading: {
    marginTop: 24,
  },
  description: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  joinCodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  joinCodeLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  joinCode: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },
  empty: {
    color: Colors.textMuted,
    fontSize: 14,
  },
});
