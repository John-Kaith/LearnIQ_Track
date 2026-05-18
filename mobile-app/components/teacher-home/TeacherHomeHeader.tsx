import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

type Props = {
  greeting: string;
  name: string;
  subtitle: string;
};

export function TeacherHomeHeader({ greeting, name, subtitle }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.greeting}>{greeting}</Text>
      <Text style={styles.name}>
        <Text style={styles.nameAccent}>{name}</Text>
        {' 👋'}
      </Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 20,
  },
  greeting: {
    color: Colors.textMuted,
    fontSize: 15,
    marginBottom: 4,
  },
  name: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  nameAccent: {
    color: Colors.secondary,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
