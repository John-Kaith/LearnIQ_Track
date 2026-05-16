import { Feather } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

type SettingsItemProps = {
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
};

export function SettingsItem({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
}: SettingsItemProps) {
  return (
    <Pressable
      onPress={onPress ?? (() => Alert.alert(title, 'Coming soon (mock).'))}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.iconWrap, { backgroundColor: `${iconColor}22` }]}>
        <Feather name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
});
