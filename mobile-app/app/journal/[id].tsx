import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { JournalDetailSection } from '@/components/journal/JournalDetailSection';
import { StackHeader } from '@/components/navigation/StackHeader';
import { Colors } from '@/constants/colors';
import type { JournalEntry } from '@/data/studentJournalMock';
import { fetchJournalById } from '@/services/journals';

export default function JournalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [entry, setEntry] = useState<JournalEntry | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchJournalById(id).then(setEntry);
  }, [id]);

  if (!entry || entry.status !== 'submitted') {
    return (
      <View style={styles.root}>
        <StackHeader title="Journal" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StackHeader title={entry.dateLabel} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}>
        {entry.submittedAt ? (
          <Text style={styles.meta}>Submitted {entry.submittedAt}</Text>
        ) : null}

        <JournalDetailSection title="Tasks Completed" content={entry.tasks} />
        <JournalDetailSection title="Skills Learned" content={entry.skills} />
        <JournalDetailSection
          title="Challenges Encountered"
          content={entry.challenges}
        />
        <JournalDetailSection title="Additional Notes" content={entry.notes} />
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
  meta: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 16,
  },
});
