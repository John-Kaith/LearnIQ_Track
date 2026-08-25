import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StackHeader } from '@/components/navigation/StackHeader';
import { Colors } from '@/constants/colors';
import { fetchLessonDetail, fetchLessonQuiz, submitQuizAttempt, type QuizQuestion } from '@/services/lessons';

export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [lessonTitle, setLessonTitle] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; totalQuestions: number } | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchLessonDetail(id).then((l) => l && setLessonTitle(l.title)).catch(() => {});
    fetchLessonQuiz(id)
      .then(setQuestions)
      .catch((e) =>
        Alert.alert('Could not load quiz', e instanceof Error ? e.message : 'Please try again.'),
      );
  }, [id]);

  const question = questions[index];
  const isLast = index === questions.length - 1;
  const pickedForCurrent = question ? selected[question.id] : undefined;

  async function handleNext() {
    if (!question || !pickedForCurrent) return;
    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }
    if (!id) return;
    setIsSubmitting(true);
    try {
      const outcome = await submitQuizAttempt(id, questions, selected);
      setResult(outcome);
    } catch (e) {
      Alert.alert('Could not submit quiz', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (result) {
    const pct = Math.round((result.score / Math.max(1, result.totalQuestions)) * 100);
    return (
      <View style={styles.root}>
        <StackHeader title="Quiz" />
        <View style={styles.resultWrap}>
          <Text style={styles.resultScore}>
            {result.score} / {result.totalQuestions}
          </Text>
          <Text style={styles.resultPct}>{pct}% correct</Text>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.nextBtn, pressed && styles.pressed]}>
            <Text style={styles.nextText}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

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
            <Text style={styles.qLabel}>
              Question {index + 1} of {questions.length}
            </Text>
            <Text style={styles.question}>{question.question}</Text>

            {question.choices.map((choice) => {
              const active = pickedForCurrent === choice.id;
              return (
                <Pressable
                  key={choice.id}
                  onPress={() => setSelected((s) => ({ ...s, [question.id]: choice.id }))}
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

        {question ? (
          <Pressable
            onPress={handleNext}
            disabled={!pickedForCurrent || isSubmitting}
            style={({ pressed }) => [
              styles.nextBtn,
              pressed && styles.pressed,
              (!pickedForCurrent || isSubmitting) && styles.nextBtnDisabled,
            ]}>
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.nextText}>{isLast ? 'Submit Quiz' : 'Next'}</Text>
            )}
          </Pressable>
        ) : null}
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
    borderColor: 'rgba(202, 138, 4, 0.5)',
    backgroundColor: 'rgba(161, 98, 7, 0.12)',
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
    backgroundColor: '#a16207',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.4)',
  },
  nextBtnDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.9 },
  nextText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  resultWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  resultScore: {
    color: Colors.text,
    fontSize: 40,
    fontWeight: '800',
  },
  resultPct: {
    color: Colors.textMuted,
    fontSize: 16,
    marginBottom: 24,
  },
});
