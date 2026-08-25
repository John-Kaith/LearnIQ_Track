import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function LogoutCard({ onLogout }: { onLogout: () => void }) {
  return (
    <Pressable
      onPress={onLogout}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.iconWrap}>
        <Feather name="log-out" size={22} color="#f87171" />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Logout</Text>
        <Text style={styles.subtitle}>Sign out from your account</Text>
      </View>
      <Feather name="chevron-right" size={20} color="#fca5a5" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.32)',
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
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  title: {
    color: '#fca5a5',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#78716c',
    fontSize: 13,
  },
});
