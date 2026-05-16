import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

type HomeHeaderProps = {
  greeting: string;
  name: string;
  subtitle: string;
};

export function HomeHeader({ greeting, name, subtitle }: HomeHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={styles.avatarGlow}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={32} color={Colors.primary} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  textCol: {
    flex: 1,
    paddingRight: 12,
  },
  greeting: {
    color: Colors.textMuted,
    fontSize: 14,
    marginBottom: 4,
  },
  name: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  avatarGlow: {
    padding: 3,
    borderRadius: 40,
    backgroundColor: 'rgba(96, 165, 250, 0.25)',
    shadowColor: '#60a5fa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 2,
    borderColor: 'rgba(96, 165, 250, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
