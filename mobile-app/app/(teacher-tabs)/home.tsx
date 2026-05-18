import { useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SectionTitle } from '@/components/student-home/SectionTitle';
import { TeacherHomeHeader } from '@/components/teacher-home/TeacherHomeHeader';
import { TeacherImmersionPreview } from '@/components/teacher-home/TeacherImmersionPreview';
import { TeacherQuickActions } from '@/components/teacher-home/TeacherQuickActions';
import { TeacherQuickStats } from '@/components/teacher-home/TeacherQuickStats';
import { TeacherSubjectCard } from '@/components/teacher-home/TeacherSubjectCard';
import { Colors } from '@/constants/colors';
import { teacherHomeMock } from '@/data/teacherHomeMock';
import { getTimeGreeting } from '@/utils/greeting';

const QUICK_STATS = [
  {
    label: 'Subjects',
    value: teacherHomeMock.stats.subjects,
    icon: 'layers-outline' as const,
    color: '#60a5fa',
  },
  {
    label: 'Published Lessons',
    value: teacherHomeMock.stats.publishedLessons,
    icon: 'book-outline' as const,
    color: '#a78bfa',
  },
  {
    label: 'Students',
    value: teacherHomeMock.stats.students,
    icon: 'people-outline' as const,
    color: '#34d399',
  },
  {
    label: 'Immersion Alerts',
    value: teacherHomeMock.stats.immersionAlerts,
    icon: 'alert-circle-outline' as const,
    color: '#fb923c',
  },
];

export default function TeacherHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { subjects, immersion, quickActions } = teacherHomeMock;

  function mockAction(label: string) {
    Alert.alert(label, 'Coming soon on mobile (mock).');
  }

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
          name={teacherHomeMock.teacherName}
          subtitle={teacherHomeMock.subtitle}
        />

        <TeacherQuickStats items={QUICK_STATS} />

        <SectionTitle title="My Subjects" />
        {subjects.map((subject) => (
          <TeacherSubjectCard
            key={subject.id}
            subject={subject}
            onOpen={() => mockAction(`Open ${subject.name}`)}
            onPublish={() => mockAction(`Publish lesson — ${subject.name}`)}
          />
        ))}

        <SectionTitle title="Immersion Monitoring" />
        <TeacherImmersionPreview
          activeStudents={immersion.activeStudents}
          pendingJournals={immersion.pendingJournals}
          onOpenMonitoring={() => router.push('/(teacher-tabs)/immersion')}
        />

        <SectionTitle title="Quick Actions" />
        <TeacherQuickActions
          items={quickActions}
          onPress={(_id, label) => mockAction(label)}
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
  },
});
