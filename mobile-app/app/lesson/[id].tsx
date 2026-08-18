import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LessonActionCard } from '@/components/learn-flow/LessonActionCard';
import { StackHeader } from '@/components/navigation/StackHeader';
import { Colors } from '@/constants/colors';
import type { LessonDetail } from '@/data/studentLearnFlowMock';
import { fetchLessonDetail } from '@/services/lessons';

export default function LessonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchLessonDetail(id)
      .then(setLesson)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Please try again.'));
  }, [id]);

  if (loadError) {
    return (
      <View style={styles.root}>
        <StackHeader title="Lesson" />
        <Text style={styles.error}>{loadError}</Text>
      </View>
    );
  }

  if (!lesson) {
    return (
      <View style={styles.root}>
        <StackHeader title="Lesson" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StackHeader title={lesson.title} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}>
        <Text style={styles.teacher}>{lesson.teacherName}</Text>
        <Text style={styles.date}>Published {lesson.publishedDate}</Text>
        <Text style={styles.description}>{lesson.description}</Text>

        <LessonActionCard
          type="reviewer"
          onPress={() =>
            router.push({ pathname: '/reviewer/[id]', params: { id: lesson.id } })
          }
        />
        <LessonActionCard
          type="quiz"
          onPress={() => router.push({ pathname: '/quiz/[id]', params: { id: lesson.id } })}
        />
        <LessonActionCard
          type="activities"
          onPress={() =>
            router.push({ pathname: '/activities/[id]', params: { id: lesson.id } })
          }
        />
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
    paddingTop: 8,
  },
  teacher: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  date: {
    color: Colors.textMuted,
    fontSize: 13,
    marginBottom: 12,
  },
  description: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  error: {
    color: '#f87171',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
  },
});
