import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { WebTheme } from '@/constants/learniqTheme';

export function LogoutCard({ onLogout }: { onLogout: () => void }) {
  return (
    <Pressable
      onPress={onLogout}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.iconWrap}>
        <Feather name="log-out" size={22} color={WebTheme.danger} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Logout</Text>
        <Text style={styles.subtitle}>Sign out from your account</Text>
      </View>
      <Feather name="chevron-right" size={20} color={WebTheme.danger} />
    </Pressable>
  );
}

// Light-mode danger colors, like the website's .btn-danger
const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WebTheme.dangerBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: WebTheme.dangerBorder,
    padding: 16,
    marginTop: 6,
    marginBottom: 8,
    gap: 12,
  },
  pressed: { opacity: 0.9 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  title: {
    color: WebTheme.danger,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#78716c',
    fontSize: 13,
  },
});
// .
