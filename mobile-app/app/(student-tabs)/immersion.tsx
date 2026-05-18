import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AttendanceLogCard } from '@/components/student-immersion/AttendanceLogCard';
import { ImmersionInfoCard } from '@/components/student-immersion/ImmersionInfoCard';
import { ImmersionProgressCard } from '@/components/student-immersion/ImmersionProgressCard';
import { SectionRow } from '@/components/student-immersion/SectionRow';
import { TodayAttendanceCard } from '@/components/student-immersion/TodayAttendanceCard';
import { TodayJournalCard } from '@/components/student-immersion/TodayJournalCard';
import { Colors } from '@/constants/colors';
import { studentImmersionMock } from '@/data/studentImmersionMock';
import { useImmersionAttendance } from '@/hooks/useImmersionAttendance';

export default function StudentImmersionScreen() {
  const insets = useSafeAreaInsets();
  const { progress, todayDate, recentLogs, info } = studentImmersionMock;
  const attendance = useImmersionAttendance();

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}>
        <Text style={styles.pageTitle}>Immersion</Text>
        <Text style={styles.pageSubtitle}>
          Track your immersion hours, attendance and daily journal.
        </Text>

        <ImmersionProgressCard
          completedHours={progress.completedHours}
          requiredHours={progress.requiredHours}
          remainingHours={progress.remainingHours}
          percentComplete={progress.percentComplete}
        />

        <TodayAttendanceCard
          todayDate={todayDate}
          statusLabel={attendance.statusLabel}
          timeIn={attendance.timeIn}
          timeOut={attendance.timeOut}
          totalHours={attendance.totalHours}
          durationLabel={attendance.durationLabel}
          captureMode={attendance.captureMode}
          pendingCapture={attendance.pendingCapture}
          captureStatus={attendance.captureStatus}
          isCapturing={attendance.isCapturing}
          canTimeIn={attendance.canTimeIn}
          canTimeOut={attendance.canTimeOut}
          onTakePhoto={attendance.takePhoto}
          onTimeIn={attendance.recordTimeIn}
          onTimeOut={attendance.recordTimeOut}
        />

        <TodayJournalCard />

        <SectionRow
          title="Recent Attendance Logs"
          actionLabel="View All"
          onAction={() => Alert.alert('Logs', 'View all attendance logs (mock).')}
        />
        {recentLogs.map((log) => (
          <AttendanceLogCard
            key={log.id}
            log={log}
            onPress={() => Alert.alert('Log', log.dateLabel)}
          />
        ))}

        <ImmersionInfoCard
          company={info.company}
          supervisor={info.supervisor}
          requiredHours={info.requiredHours}
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
