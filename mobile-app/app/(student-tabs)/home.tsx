import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ContinueLearningCard } from '@/components/student-home/ContinueLearningCard';
import { HomeHeader } from '@/components/student-home/HomeHeader';
import { LeaderboardPreviewCard } from '@/components/student-home/LeaderboardPreviewCard';
import { QuickAccessGrid } from '@/components/student-home/QuickAccessGrid';
import { SectionTitle } from '@/components/student-home/SectionTitle';
import { StatsOverview } from '@/components/student-home/StatsOverview';
import { UpcomingImmersionCard } from '@/components/student-home/UpcomingImmersionCard';
import { Colors } from '@/constants/colors';
import { fetchStudentDashboardStats, type StudentDashboardStats } from '@/services/dashboard';
import { fetchAttendanceHistory, IMMERSION_REQUIRED_HOURS, formatDisplayTime } from '@/services/immersion';
import { fetchLatestLessonForHome, fetchStudentSubjects, type LatestLesson } from '@/services/lessons';
import { useAuthStore } from '@/store/authStore';

const QUICK_ACCESS = [
  { id: 'lessons', label: 'My Lessons', icon: 'book-outline' as const, color: '#fbbf24' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'trophy-outline' as const, color: '#ca8a04' },
  { id: 'history', label: 'History', icon: 'time-outline' as const, color: '#f87171' },
  { id: 'modules', label: 'Module Selection', icon: 'grid-outline' as const, color: '#34d399' },
];

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 18) return 'Good afternoon,';
  return 'Good evening,';
}

export default function StudentHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [subjectCount, setSubjectCount] = useState(0);
  const [lessonCount, setLessonCount] = useState(0);
  const [stats, setStats] = useState<StudentDashboardStats | null>(null);
  const [latestLesson, setLatestLesson] = useState<LatestLesson | null>(null);
  const [todayTimeIn, setTodayTimeIn] = useState<string | null>(null);
  const [todayTimeOut, setTodayTimeOut] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchStudentSubjects()
        .then((subjects) => {
          setSubjectCount(subjects.length);
          setLessonCount(subjects.reduce((sum, s) => sum + s.lessonCount, 0));
        })
        .catch(() => {
          setSubjectCount(0);
          setLessonCount(0);
        });

      fetchStudentDashboardStats()
        .then(setStats)
        .catch(() => setStats(null));

      fetchLatestLessonForHome()
        .then(setLatestLesson)
        .catch(() => setLatestLesson(null));

      fetchAttendanceHistory()
        .then(({ active }) => {
          setTodayTimeIn(active?.time_in ? formatDisplayTime(active.time_in) : null);
          setTodayTimeOut(active?.time_out ? formatDisplayTime(active.time_out) : null);
        })
        .catch(() => {
          setTodayTimeIn(null);
          setTodayTimeOut(null);
        });
    }, []),
  );

  const gradeStrand = [
    user?.grade_level ? `Grade ${user.grade_level}` : null,
    user?.strand || null,
  ]
    .filter(Boolean)
    .join(' • ');

  const statItems = [
    { icon: 'book' as const, value: subjectCount, label: 'Subjects', color: '#ca8a04' },
    { icon: 'document-text' as const, value: lessonCount, label: 'Lessons', color: '#fbbf24' },
    { icon: 'checkmark-circle' as const, value: stats?.quizAttempts ?? 0, label: 'Quiz Attempts', color: '#34d399' },
    { icon: 'trophy' as const, value: stats?.leaderboardRank ?? 0, label: 'LB Rank', color: '#fb923c' },
  ];

  const leaderboardLabel =
    stats?.leaderboardRank != null
      ? stats.leaderboardRank === 1
        ? '🏆 #1 You'
        : `#${stats.leaderboardRank} You`
      : 'Not ranked yet';
  const leaderboardXp = `${stats?.totalPoints ?? 0} pts`;

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}>
        <HomeHeader
          greeting={greetingForNow()}
          name={user?.first_name ? `${user.first_name}!` : (user?.display_name ?? 'Student')}
          subtitle="Keep learning, keep growing. 🚀"
        />

        <StatsOverview items={statItems} />

        {latestLesson ? (
          <ContinueLearningCard
            grade={gradeStrand || 'My lesson'}
            subject={latestLesson.subjectTitle}
            lesson={latestLesson.lessonTitle}
            onPress={() => router.push(`/lesson/${latestLesson.lessonId}`)}
          />
        ) : null}

        <SectionTitle title="Quick Access" />
        <QuickAccessGrid items={QUICK_ACCESS} />

        <SectionTitle title="Today's Immersion" />
        <UpcomingImmersionCard
          timeIn={todayTimeIn ?? 'Not checked in yet'}
          timeOut={todayTimeOut ?? (todayTimeIn ? 'Still ongoing' : '—')}
        />

        <SectionTitle title="Leaderboard Preview" />
        <LeaderboardPreviewCard label={leaderboardLabel} xp={leaderboardXp} />
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
