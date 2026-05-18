import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { JournalHistoryCard } from '@/components/journal/JournalHistoryCard';
import { StackHeader } from '@/components/navigation/StackHeader';
import { Colors } from '@/constants/colors';
import type { JournalEntry } from '@/data/studentJournalMock';
import { fetchJournalHistory } from '@/services/journals';

export default function JournalHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchJournalHistory().then(setEntries);
    }, []),
  );

  return (
    <View style={styles.root}>
      <StackHeader title="Journal History" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}>
        <Text style={styles.subtitle}>View your submitted immersion journals.</Text>

        {entries.map((entry) => (
          <JournalHistoryCard
            key={entry.id}
            entry={entry}
            onPress={() =>
              router.push({ pathname: '/journal/[id]', params: { id: entry.id } })
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
    paddingTop: 8,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
});
