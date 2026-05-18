import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { JoinSubjectCard } from '@/components/student-learn/JoinSubjectCard';
import { MySubjectsHeader } from '@/components/student-learn/MySubjectsHeader';
import { SubjectCard } from '@/components/student-learn/SubjectCard';
import { Colors } from '@/constants/colors';
import { studentLearnMock, type StudentSubject } from '@/data/studentLearnMock';

export default function StudentLearnScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [subjects, setSubjects] = useState<StudentSubject[]>(studentLearnMock.subjects);

  function handleRefresh() {
    setSubjects([...studentLearnMock.subjects]);
    Alert.alert('Refreshed', 'Subject list updated (mock).');
  }

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>My Lesson</Text>
        <Text style={styles.pageSubtitle}>
          Access your enrolled subjects and published lessons.
        </Text>

        <JoinSubjectCard />

        <MySubjectsHeader onRefresh={handleRefresh} />

        {subjects.map((subject) => (
          <SubjectCard
            key={subject.id}
            subject={subject}
            onOpen={() =>
              router.push({ pathname: '/subject/[id]', params: { id: subject.id } })
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
  },
  pageTitle: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  pageSubtitle: {
    color: Colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
  },
});
