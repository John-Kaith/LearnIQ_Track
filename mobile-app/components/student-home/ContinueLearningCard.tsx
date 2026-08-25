import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';

type ContinueLearningCardProps = {
  grade: string;
  subject: string;
  lesson: string;
  /** Omit when there's no real per-lesson progress to report — the progress bar hides itself. */
  progress?: number;
  onPress?: () => void;
};

export function ContinueLearningCard({
  grade,
  subject,
  lesson,
  progress,
  onPress,
}: ContinueLearningCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <Text style={styles.title}>Continue Learning</Text>
        <Text style={styles.meta}>
          {grade} • {subject}
        </Text>
        <Text style={styles.lesson}>{lesson}</Text>

        {progress != null ? (
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{progress}%</Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={onPress}>
          <Ionicons name="play" size={16} color="#fff" style={styles.playIcon} />
          <Text style={styles.ctaText}>Continue Lesson</Text>
        </Pressable>
      </View>

      <View style={styles.illustration}>
        <View style={styles.sparkle}>
          <Ionicons name="sparkles" size={14} color="rgba(255,255,255,0.5)" />
        </View>
        <View style={[styles.book, styles.bookBack]}>
          <Ionicons name="book" size={28} color="#eab308" />
        </View>
        <View style={[styles.book, styles.bookMid]}>
          <Ionicons name="book" size={32} color="#ca8a04" />
        </View>
        <View style={styles.cap}>
          <Ionicons name="school" size={26} color={Colors.text} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSoft,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(202, 138, 4, 0.22)',
    padding: 18,
    marginBottom: 22,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  meta: {
    color: Colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  lesson: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 14,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(120, 53, 15, 0.15)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 6,
  },
  progressText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    minWidth: 32,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#a16207',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.4)',
  },
  ctaPressed: { opacity: 0.9 },
  playIcon: { marginRight: 6 },
  ctaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  illustration: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sparkle: {
    position: 'absolute',
    top: 0,
    right: 4,
  },
  book: {
    position: 'absolute',
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(161, 98, 7, 0.15)',
  },
  bookBack: {
    bottom: 28,
    right: 8,
    opacity: 0.7,
  },
  bookMid: {
    bottom: 12,
    right: 20,
  },
  cap: {
    position: 'absolute',
    top: 8,
    right: 16,
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
  },
});
