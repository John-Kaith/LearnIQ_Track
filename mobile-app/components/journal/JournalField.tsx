import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { MAX_FIELD_LENGTH } from '@/data/studentJournalMock';

type JournalFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  optional?: boolean;
  placeholder?: string;
};

export function JournalField({
  label,
  value,
  onChangeText,
  optional,
  placeholder,
}: JournalFieldProps) {
  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optional ? <Text style={styles.optional}>Optional</Text> : null}
      </View>
      <TextInput
        value={value}
        onChangeText={(t) => onChangeText(t.slice(0, MAX_FIELD_LENGTH))}
        placeholder={placeholder ?? 'Write your response...'}
        placeholderTextColor={Colors.textMuted}
        multiline
        textAlignVertical="top"
        style={styles.input}
      />
      <Text style={styles.counter}>
        {value.length}/{MAX_FIELD_LENGTH}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  label: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  optional: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  input: {
    minHeight: 100,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  counter: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 8,
  },
});
