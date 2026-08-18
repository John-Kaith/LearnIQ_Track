import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StackHeader } from '@/components/navigation/StackHeader';
import { Colors } from '@/constants/colors';
import { fetchLessonDetail, fetchLessonQuiz, type QuizQuestion } from '@/services/lessons';

export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [lessonTitle, setLessonTitle] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchLessonDetail(id).then((l) => l && setLessonTitle(l.title)).catch(() => {});
    fetchLessonQuiz(id)
      .then(setQuestions)
      .catch((e) =>
        Alert.alert('Could not load quiz', e instanceof Error ? e.message : 'Please try again.'),
      );
  }, [id]);

  const question = questions[0];

  return (
    <View style={styles.root}>
      <StackHeader title="Quiz" />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}>
        {lessonTitle ? <Text style={styles.lesson}>{lessonTitle}</Text> : null}

        {question ? (
          <View style={styles.card}>
            <Text style={styles.qLabel}>Question 1</Text>
            <Text style={styles.question}>{question.question}</Text>

            {question.choices.map((choice) => {
              const active = selected === choice.id;
              return (
                <Pressable
                  key={choice.id}
                  onPress={() => setSelected(choice.id)}
                  style={[styles.choice, active && styles.choiceActive]}>
                  <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                    {choice.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.empty}>No quiz available for this lesson yet.</Text>
        )}

        <Pressable
          onPress={() =>
            Alert.alert('Quiz', 'Next question — coming soon (mock).')
          }
          style={({ pressed }) => [styles.nextBtn, pressed && styles.pressed]}>
          <Text style={styles.nextText}>Next</Text>
        </Pressable>
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
  lesson: {
    color: Colors.textMuted,
    fontSize: 14,
    marginBottom: 16,
  },
  card: {
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginBottom: 20,
  },
  qLabel: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  question: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 16,
  },
  choice: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    backgroundColor: Colors.background,
  },
  choiceActive: {
    borderColor: 'rgba(96, 165, 250, 0.5)',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  choiceText: {
    color: Colors.text,
    fontSize: 14,
  },
  choiceTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  empty: {
    color: Colors.textMuted,
    fontSize: 15,
    marginBottom: 20,
  },
  nextBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  pressed: { opacity: 0.9 },
  nextText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
