import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SectionTitle } from '@/components/student-home/SectionTitle';
import { TeacherHomeHeader } from '@/components/teacher-home/TeacherHomeHeader';
import { TeacherQuickActions } from '@/components/teacher-home/TeacherQuickActions';
import { TeacherQuickStats } from '@/components/teacher-home/TeacherQuickStats';
import { TeacherSubjectCard } from '@/components/teacher-home/TeacherSubjectCard';
import { Colors } from '@/constants/colors';
import { fetchTeacherDashboardStats, type TeacherDashboardStats } from '@/services/dashboard';
import { fetchTeacherSubjects, type TeacherSubject } from '@/services/subjects';
import { useAuthStore } from '@/store/authStore';
import { getTimeGreeting } from '@/utils/greeting';

const QUICK_ACTIONS = [
  { id: 'upload', label: 'Upload Lesson', icon: 'cloud-upload-outline' as const, color: '#ca8a04' },
  { id: 'journals', label: 'Review Journals', icon: 'journal-outline' as const, color: '#fbbf24' },
  { id: 'attendance', label: 'Attendance Logs', icon: 'list-outline' as const, color: '#34d399' },
];

export default function TeacherHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [subjects, setSubjects] = useState<TeacherSubject[]>([]);
  const [stats, setStats] = useState<TeacherDashboardStats | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchTeacherSubjects()
        .then(setSubjects)
        .catch(() => setSubjects([]));
      fetchTeacherDashboardStats()
        .then(setStats)
        .catch(() => setStats(null));
    }, []),
  );

  function comingSoon(label: string) {
    Alert.alert(label, 'This isn’t built on mobile yet — use the web app for now.');
  }

  const quickStats = [
    {
      label: 'Subjects',
      value: stats?.subjectsCount ?? subjects.length,
      icon: 'layers-outline' as const,
      color: '#ca8a04',
    },
    {
      label: 'Published Lessons',
      value: stats?.lessonsPublished ?? 0,
      icon: 'book-outline' as const,
      color: '#fbbf24',
    },
    {
      label: 'Enrolled Students',
      value: stats?.enrolledStudents ?? 0,
      icon: 'people-outline' as const,
      color: '#34d399',
    },
    {
      label: 'Quiz Attempts',
      value: stats?.quizAttemptsTotal ?? 0,
      icon: 'stats-chart-outline' as const,
      color: '#fb923c',
    },
  ];

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}>
        <TeacherHomeHeader
          greeting={getTimeGreeting()}
          name={user?.first_name ? `${user.first_name}!` : (user?.display_name ?? 'Teacher')}
          subtitle="Manage your classes and monitor students."
        />

        <TeacherQuickStats items={quickStats} />

        <SectionTitle title="My Subjects" />
        {subjects.length === 0 ? null : (
          subjects.map((subject) => (
            <TeacherSubjectCard
              key={subject.id}
              subject={subject}
              onOpen={() => router.push({ pathname: '/teacher-subject/[id]', params: { id: subject.id } })}
            />
          ))
        )}

        <SectionTitle title="Quick Actions" />
        <TeacherQuickActions items={QUICK_ACTIONS} onPress={(_id, label) => comingSoon(label)} />
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
});
