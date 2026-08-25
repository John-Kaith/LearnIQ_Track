import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchLessonDetail(id).then((l) => l && setLessonTitle(l.title)).catch(() => {});
    fetchLessonActivities(id)
      .then(setActivities)
      .catch((e) =>
        Alert.alert('Could not load activities', e instanceof Error ? e.message : 'Please try again.'),
      );
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
            <View key={item.id} style={styles.card}>
              <Pressable
                onPress={() => setExpandedId((cur) => (cur === item.id ? null : item.id))}
                style={({ pressed }) => [styles.cardHead, pressed && styles.pressed]}>
                <View style={styles.num}>
                  <Text style={styles.numText}>{index + 1}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.type}>{item.type}</Text>
                </View>
                <Feather
                  name={expandedId === item.id ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={Colors.textMuted}
                />
              </Pressable>

              {expandedId === item.id ? (
                item.type === 'Essay' ? (
                  <EssayActivity item={item} />
                ) : (
                  <FlashcardsActivity item={item} />
                )
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function EssayActivity({ item }: { item: Extract<ActivityItem, { type: 'Essay' }> }) {
  const [response, setResponse] = useState('');
  const [showSample, setShowSample] = useState(false);

  return (
    <View style={styles.body}>
      <Text style={styles.question}>{item.question}</Text>
      <TextInput
        value={response}
        onChangeText={setResponse}
        placeholder="Write your answer here..."
        placeholderTextColor={Colors.textMuted}
        multiline
        style={styles.essayInput}
      />
      <Pressable
        onPress={() => setShowSample((s) => !s)}
        style={({ pressed }) => [styles.sampleBtn, pressed && styles.pressed]}>
        <Text style={styles.sampleBtnText}>
          {showSample ? 'Hide Sample Answer' : 'Show Sample Answer'}
        </Text>
      </Pressable>
      {showSample ? <Text style={styles.sampleText}>{item.sampleAnswer}</Text> : null}
    </View>
  );
}

function FlashcardsActivity({ item }: { item: Extract<ActivityItem, { type: 'Flashcards' }> }) {
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = item.cards[cardIndex];
  if (!card) return null;

  return (
    <View style={styles.body}>
      <Pressable
        onPress={() => setFlipped((f) => !f)}
        style={({ pressed }) => [styles.flashcard, pressed && styles.pressed]}>
        <Text style={styles.flashcardLabel}>{flipped ? 'Answer' : 'Question'}</Text>
        <Text style={styles.flashcardText}>{flipped ? card.back : card.front}</Text>
        <Text style={styles.flashcardHint}>Tap to flip</Text>
      </Pressable>
      <View style={styles.flashcardNav}>
        <Pressable
          disabled={cardIndex === 0}
          onPress={() => {
            setCardIndex((i) => Math.max(0, i - 1));
            setFlipped(false);
          }}
          style={({ pressed }) => [
            styles.navBtn,
            cardIndex === 0 && styles.navBtnDisabled,
            pressed && styles.pressed,
          ]}>
          <Text style={styles.navBtnText}>Prev</Text>
        </Pressable>
        <Text style={styles.flashcardCounter}>
          {cardIndex + 1} / {item.cards.length}
        </Text>
        <Pressable
          disabled={cardIndex === item.cards.length - 1}
          onPress={() => {
            setCardIndex((i) => Math.min(item.cards.length - 1, i + 1));
            setFlipped(false);
          }}
          style={({ pressed }) => [
            styles.navBtn,
            cardIndex === item.cards.length - 1 && styles.navBtnDisabled,
            pressed && styles.pressed,
          ]}>
          <Text style={styles.navBtnText}>Next</Text>
        </Pressable>
      </View>
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
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  pressed: { opacity: 0.9 },
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
  body: {
    padding: 14,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  question: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
    marginBottom: 12,
  },
  essayInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
    textAlignVertical: 'top',
    color: Colors.text,
    fontSize: 14,
    backgroundColor: Colors.background,
    marginBottom: 12,
  },
  sampleBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(202, 138, 4, 0.4)',
    backgroundColor: 'rgba(161, 98, 7, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sampleBtnText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  sampleText: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  flashcard: {
    marginTop: 12,
    minHeight: 130,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 8,
  },
  flashcardLabel: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  flashcardText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  flashcardHint: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  flashcardNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  navBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  flashcardCounter: {
    color: Colors.textMuted,
    fontSize: 12,
  },
});
