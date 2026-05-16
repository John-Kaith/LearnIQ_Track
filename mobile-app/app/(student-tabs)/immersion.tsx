import { useState } from 'react';
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

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function StudentImmersionScreen() {
  const insets = useSafeAreaInsets();
  const { progress, todayDate, recentLogs, info } = studentImmersionMock;

  const [timeIn, setTimeIn] = useState<string | null>(null);
  const [timeOut, setTimeOut] = useState<string | null>(null);
  const [totalHours, setTotalHours] = useState(0);
  const [timeInStatus, setTimeInStatus] = useState('Not yet time in');
  const [timeOutStatus, setTimeOutStatus] = useState('Not yet time out');

  function handleTimeIn() {
    if (timeIn) {
      Alert.alert('Already timed in', 'You have already timed in today (mock).');
      return;
    }
    const now = formatTime(new Date());
    setTimeIn(now);
    setTimeInStatus('Timed in');
    Alert.alert('Time In', `Recorded at ${now} (mock).`);
  }

  function handleTimeOut() {
    if (!timeIn) {
      Alert.alert('Time in first', 'Please time in before timing out.');
      return;
    }
    if (timeOut) {
      Alert.alert('Already timed out', 'You have already timed out today (mock).');
      return;
    }
    const now = formatTime(new Date());
    setTimeOut(now);
    setTimeOutStatus('Timed out');
    setTotalHours(8.0);
    Alert.alert('Time Out', `Recorded at ${now} (mock).`);
  }

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
          timeIn={timeIn}
          timeOut={timeOut}
          totalHours={totalHours}
          timeInStatus={timeInStatus}
          timeOutStatus={timeOutStatus}
          onTimeIn={handleTimeIn}
          onTimeOut={handleTimeOut}
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
