import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { StackHeader } from '@/components/navigation/StackHeader';
import { Colors } from '@/constants/colors';
import {
  fetchLessonActivities,
  fetchLessonDetail,
  type ActivityItem,
} from '@/services/lessons';

export default function ActivitiesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [lessonTitle, setLessonTitle] = useState('');
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!id) return;
    fetchLessonDetail(id).then((l) => l && setLessonTitle(l.title));
    fetchLessonActivities(id).then(setActivities);
  }, [id]);

  return (
    <View style={styles.root}>
      <StackHeader title="Activities" />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}>
        {lessonTitle ? <Text style={styles.lesson}>{lessonTitle}</Text> : null}

        {activities.length === 0 ? (
          <Text style={styles.empty}>No activities for this lesson yet.</Text>
        ) : (
          activities.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() =>
                Alert.alert(item.title, `${item.type} — coming soon (mock).`)
              }
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={styles.num}>
                <Text style={styles.numText}>{index + 1}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.type}>{item.type}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={Colors.textMuted} />
            </Pressable>
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
    paddingTop: 8,
  },
  lesson: {
    color: Colors.textMuted,
    fontSize: 14,
    marginBottom: 16,
  },
  empty: {
    color: Colors.textMuted,
    fontSize: 15,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  pressed: { opacity: 0.92 },
  num: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: {
    color: '#34d399',
    fontSize: 14,
    fontWeight: '800',
  },
  flex: { flex: 1 },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  type: {
    color: Colors.textMuted,
    fontSize: 12,
  },
});
