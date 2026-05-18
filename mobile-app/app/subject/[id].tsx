import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LessonListCard } from '@/components/learn-flow/LessonListCard';
import { StackHeader } from '@/components/navigation/StackHeader';
import { Colors } from '@/constants/colors';
import type { LessonSummary } from '@/data/studentLearnFlowMock';
import { fetchSubjectLessons, fetchSubjectTitle } from '@/services/lessons';

export default function SubjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('Subject');
  const [lessons, setLessons] = useState<LessonSummary[]>([]);

  useEffect(() => {
    if (!id) return;
    fetchSubjectTitle(id).then(setTitle);
    fetchSubjectLessons(id).then(setLessons);
  }, [id]);

  return (
    <View style={styles.root}>
      <StackHeader title={title} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}>
        <Text style={styles.subtitle}>Published lessons for this subject.</Text>

        {lessons.map((lesson) => (
          <LessonListCard
            key={lesson.id}
            lesson={lesson}
            onPress={() =>
              router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } })
            }
          />
        ))}
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
  subtitle: {
    color: Colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
});
