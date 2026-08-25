import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { JournalField } from '@/components/journal/JournalField';
import { StackHeader } from '@/components/navigation/StackHeader';
import { Colors } from '@/constants/colors';
import { submitJournal } from '@/services/journals';

export default function JournalCreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState('');
  const [skills, setSkills] = useState('');
  const [challenges, setChallenges] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!tasks.trim() || !skills.trim() || !challenges.trim()) {
      Alert.alert(
        'Incomplete journal',
        'Please fill in tasks, skills learned, and challenges before submitting.',
      );
      return;
    }

    setSubmitting(true);
    try {
      await submitJournal({ tasks, skills, challenges, notes });
      router.replace('/journal/history');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <StackHeader title="Today's Journal" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 100 },
          ]}>
          <Text style={styles.subtitle}>
            Reflect on your immersion experience for today.
          </Text>

          <JournalField
            label="What tasks did you accomplish today?"
            value={tasks}
            onChangeText={setTasks}
            placeholder="Describe the work you completed..."
          />
          <JournalField
            label="What skills or learnings did you gain?"
            value={skills}
            onChangeText={setSkills}
            placeholder="Share new skills or insights..."
          />
          <JournalField
            label="Did you encounter any challenges?"
            value={challenges}
            onChangeText={setChallenges}
            placeholder="Describe any difficulties..."
          />
          <JournalField
            label="Additional Notes"
            value={notes}
            onChangeText={setNotes}
            optional
            placeholder="Anything else you'd like to note..."
          />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={({ pressed }) => [
              styles.submitBtn,
              pressed && !submitting && styles.pressed,
              submitting && styles.disabled,
            ]}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Submit Journal</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: { flex: 1 },
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
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  submitBtn: {
    backgroundColor: '#a16207',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.4)',
  },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.6 },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
