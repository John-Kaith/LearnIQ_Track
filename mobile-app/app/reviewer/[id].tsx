import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StackHeader } from '@/components/navigation/StackHeader';
import { Colors } from '@/constants/colors';
import { fetchLessonDetail, fetchLessonReviewer } from '@/services/lessons';

export default function ReviewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('Reviewer');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!id) return;
    fetchLessonDetail(id).then((l) => l && setTitle(l.title));
    fetchLessonReviewer(id).then(setContent);
  }, [id]);

  return (
    <View style={styles.root}>
      <StackHeader title="Reviewer" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}>
        <Text style={styles.lessonTitle}>{title}</Text>
        <Text style={styles.body}>{content}</Text>
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
    paddingTop: 12,
  },
  lessonTitle: {
    color: Colors.textMuted,
    fontSize: 14,
    marginBottom: 16,
  },
  body: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 24,
  },
});
