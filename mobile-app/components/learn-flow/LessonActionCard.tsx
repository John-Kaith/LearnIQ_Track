import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { WebTheme } from '@/constants/learniqTheme';

type ActionType = 'reviewer' | 'quiz' | 'activities';

const CONFIG: Record<
  ActionType,
  { icon: keyof typeof Feather.glyphMap; title: string; subtitle: string }
> = {
  reviewer: {
    icon: 'book-open',
    title: 'Reviewer',
    subtitle: 'Study guide and key concepts',
  },
  quiz: {
    icon: 'edit-3',
    title: 'Quiz',
    subtitle: 'Test your understanding',
  },
  activities: {
    icon: 'folder',
    title: 'Activities',
    subtitle: 'Hands-on tasks and worksheets',
  },
};

export function LessonActionCard({
  type,
  onPress,
}: {
  type: ActionType;
  onPress: () => void;
}) {
  const cfg = CONFIG[type];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.iconWrap}>
        <Feather name={cfg.icon} size={24} color={Colors.primary} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{cfg.title}</Text>
        <Text style={styles.subtitle}>{cfg.subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  pressed: { opacity: 0.92 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WebTheme.softBg,
  },
  text: { flex: 1 },
  title: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 13,
  },
});
// .
