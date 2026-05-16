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
import { studentHomeMock } from '@/data/studentHomeMock';

const STAT_ITEMS = [
  { icon: 'book' as const, value: studentHomeMock.stats.subjects, label: 'Subjects', color: '#60a5fa' },
  { icon: 'document-text' as const, value: studentHomeMock.stats.lessons, label: 'Lessons', color: '#a78bfa' },
  { icon: 'checkmark-circle' as const, value: studentHomeMock.stats.completed, label: 'Completed', color: '#34d399' },
  { icon: 'flame' as const, value: studentHomeMock.stats.streak, label: 'Day Streak', color: '#fb923c' },
];

export default function StudentHomeScreen() {
  const insets = useSafeAreaInsets();
  const { continueLearning, immersion, leaderboard } = studentHomeMock;

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}>
        <HomeHeader
          greeting={studentHomeMock.greeting}
          name={studentHomeMock.name}
          subtitle={studentHomeMock.subtitle}
        />

        <StatsOverview items={STAT_ITEMS} />

        <ContinueLearningCard
          grade={continueLearning.grade}
          subject={continueLearning.subject}
          lesson={continueLearning.lesson}
          progress={continueLearning.progress}
        />

        <SectionTitle title="Quick Access" />
        <QuickAccessGrid items={studentHomeMock.quickAccess} />

        <SectionTitle title="Upcoming Immersion" />
        <UpcomingImmersionCard timeIn={immersion.timeIn} timeOut={immersion.timeOut} />

        <SectionTitle title="Leaderboard Preview" actionLabel="View All" onAction={() => {}} />
        <LeaderboardPreviewCard label={leaderboard.label} xp={leaderboard.xp} />
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
