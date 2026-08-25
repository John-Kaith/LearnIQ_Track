import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TeacherSubjectListCard } from '@/components/teacher-subjects/TeacherSubjectListCard';
import { Colors } from '@/constants/colors';
import { fetchTeacherSubjects, type TeacherSubject } from '@/services/subjects';

export default function TeacherSubjectsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [subjects, setSubjects] = useState<TeacherSubject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSubjects = useCallback(async () => {
    try {
      setSubjects(await fetchTeacherSubjects());
    } catch (e) {
      Alert.alert('Could not load subjects', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSubjects();
    }, [loadSubjects]),
  );

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}>
        <Text style={styles.pageTitle}>My Subjects</Text>
        <Text style={styles.pageSubtitle}>Subjects you own — tap one to manage lessons and attendance.</Text>

        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={styles.loading} />
        ) : subjects.length === 0 ? (
          <Text style={styles.empty}>You haven&apos;t created any subjects yet.</Text>
        ) : (
          subjects.map((subject) => (
            <TeacherSubjectListCard
              key={subject.id}
              subject={subject}
              onPress={() =>
                router.push({ pathname: '/teacher-subject/[id]', params: { id: subject.id } })
              }
            />
          ))
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
  loading: {
    marginTop: 24,
  },
  empty: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
});
