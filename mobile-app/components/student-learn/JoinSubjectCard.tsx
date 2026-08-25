import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { joinSubjectByCode } from '@/services/lessons';

export function JoinSubjectCard({ onJoined }: { onJoined?: () => void }) {
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  async function handleJoin() {
    if (!code.trim() || isJoining) return;
    setIsJoining(true);
    try {
      const { subjectName } = await joinSubjectByCode(code);
      setCode('');
      Alert.alert('Joined!', `You're now enrolled in ${subjectName}.`);
      onJoined?.();
    } catch (e) {
      Alert.alert('Could not join', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Join a Subject</Text>
      <Text style={styles.subtitle}>Enter your teacher&apos;s class code to join a subject.</Text>

      <Text style={styles.label}>Class code</Text>
      <View style={styles.row}>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="e.g. MAT-C5DL"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!isJoining}
          style={styles.input}
        />
        <Pressable
          onPress={handleJoin}
          disabled={isJoining}
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, isJoining && styles.btnDisabled]}>
          {isJoining ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.btnText}>Join Class</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginBottom: 24,
  },
  title: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  label: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    minWidth: 0,
  },
  btn: {
    backgroundColor: '#a16207',
    borderRadius: 12,
    paddingHorizontal: 16,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.45)',
    shadowColor: '#eab308',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnPressed: { opacity: 0.9 },
  btnDisabled: { opacity: 0.7 },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
