import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

export default function TeacherSubjectsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Teacher Subjects</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '600',
  },
});
