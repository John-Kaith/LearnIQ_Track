import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccentFill, accentShadow } from '@/components/ui/AccentFill';
import { WebBackground } from '@/components/ui/WebBackground';
import { Colors } from '@/constants/colors';
import { WebTheme } from '@/constants/learniqTheme';
import { ARCADE_GAMES, type ArcadeGame } from '@/constants/arcadeGames';
import {
  fetchArcadeStats,
  fetchArcadeTopPlayers,
  type ArcadeGameRecord,
  type ArcadePlayer,
  type ArcadeStats,
  type ArcadeTopPlayers,
} from '@/services/arcade';

const GAP = 12;
const SIDE = 20;

function recordLine(record: ArcadeGameRecord | undefined): string {
  if (!record || record.matches === 0) return 'Not played yet';
  const matches = `${record.matches} ${record.matches === 1 ? 'match' : 'matches'}`;
  return record.wins ? `${matches} · ${record.wins} ${record.wins === 1 ? 'win' : 'wins'}` : matches;
}

export default function StudentArcadeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const columns = width >= 720 ? 3 : 2; // tablets get a third column
  const cardWidth = Math.floor((width - SIDE * 2 - GAP * (columns - 1)) / columns);

  const [stats, setStats] = useState<ArcadeStats | null>(null);
  const [top, setTop] = useState<ArcadeTopPlayers | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [s, t] = await Promise.allSettled([fetchArcadeStats(), fetchArcadeTopPlayers(5)]);
    if (s.status === 'fulfilled') setStats(s.value);
    else setError(s.reason instanceof Error ? s.reason.message : 'Could not load your Arcade level.');
    if (t.status === 'fulfilled') setTop(t.value);
    setLoading(false);
  }, []);

  // Back from a game: show the EXP it just earned.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const play = (game: ArcadeGame) => router.push({ pathname: '/play/[game]', params: { game: game.id } });

  const level = stats?.level ?? 0;
  const pct = stats ? Math.min(100, Math.round((stats.expIntoLevel / stats.expPerLevel) * 100)) : 0;
  const totals = stats
    ? Object.values(stats.games).reduce((acc, g) => ({ matches: acc.matches + g.matches, wins: acc.wins + g.wins }), {
        matches: 0,
        wins: 0,
      })
    : { matches: 0, wins: 0 };

  return (
    <View style={styles.root}>
      <WebBackground />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
        <Text style={styles.pageTitle}>Arcade</Text>
        <Text style={styles.pageSubtitle}>Play games made from your own lessons. Every win earns EXP.</Text>

        {/* Arcade level */}
        <View style={styles.levelCard}>
          <View style={styles.levelBadge}>
            <AccentFill radius={32} />
            <Text style={styles.levelBadgeSmall}>LV</Text>
            <Text style={styles.levelBadgeNum}>{level}</Text>
          </View>
          <View style={styles.levelBody}>
            <Text style={styles.levelTitle}>Arcade level {level}</Text>
            {loading && !stats ? (
              <ActivityIndicator color={Colors.primary} style={styles.levelLoading} />
            ) : (
              <>
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${pct}%` }]}>
                    <AccentFill radius={5} />
                  </View>
                </View>
                <Text style={styles.levelMeta}>
                  {stats ? `${stats.expIntoLevel} / ${stats.expPerLevel} EXP to LV ${level + 1}` : '—'}
                </Text>
                <Text style={styles.levelMeta}>
                  {totals.matches ? `${totals.matches} matches · ${totals.wins} wins` : 'Win games to level up.'}
                </Text>
              </>
            )}
          </View>
        </View>
        {error ? (
          <Pressable onPress={onRefresh} style={styles.errorRow}>
            <Feather name="alert-circle" size={14} color="#b91c1c" />
            <Text style={styles.errorText}>{error} Tap to retry.</Text>
          </Pressable>
        ) : null}

        {/* Games */}
        <Text style={styles.sectionTitle}>Games</Text>
        <View style={styles.grid}>
          {ARCADE_GAMES.map((game) => (
            <Pressable
              key={game.id}
              accessibilityRole="button"
              accessibilityLabel={`Play ${game.name}`}
              onPress={() => play(game)}
              style={({ pressed }) => [styles.gameCard, { width: cardWidth }, pressed && styles.gameCardPressed]}>
              <Image source={game.cover} style={styles.cover} contentFit="cover" transition={150} />
              <View style={styles.gameBody}>
                <Text style={styles.gameName} numberOfLines={1}>
                  {game.name}
                </Text>
                <Text style={styles.gameDesc} numberOfLines={2}>
                  {game.card}
                </Text>
                <View style={styles.gameFooter}>
                  <Text style={styles.gameRecord} numberOfLines={1}>
                    {recordLine(stats?.games[game.id])}
                  </Text>
                  <View style={styles.playCta}>
                    <Text style={styles.playText}>Play</Text>
                    <Ionicons name="arrow-forward" size={13} color={WebTheme.softText} />
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Top players */}
        <Text style={styles.sectionTitle}>
          Top players{top?.schoolYear ? ` · S.Y. ${top.schoolYear}` : ''}
        </Text>
        <View style={styles.topCard}>
          {!top ? (
            <ActivityIndicator color={Colors.primary} style={styles.topLoading} />
          ) : top.players.length === 0 ? (
            <Text style={styles.topEmpty}>No one has played yet. Be the first!</Text>
          ) : (
            <>
              {top.players.map((p) => (
                <PlayerRow key={`${p.rank}-${p.idNumber}`} player={p} />
              ))}
              {top.me ? (
                <>
                  <View style={styles.topDivider} />
                  <PlayerRow player={top.me} />
                </>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function PlayerRow({ player }: { player: ArcadePlayer }) {
  // .arcade-rank.is-1 / is-2 / is-3 on the website
  const medal =
    player.rank === 1
      ? { bg: '#fde047', fg: '#713f12' }
      : player.rank === 2
        ? { bg: '#e2e8f0', fg: '#334155' }
        : player.rank === 3
          ? { bg: '#fdba74', fg: '#7c2d12' }
          : null;
  return (
    <View style={[styles.playerRow, player.isMe && styles.playerRowMe]}>
      <View style={[styles.rank, medal ? { backgroundColor: medal.bg } : null]}>
        <Text style={[styles.rankText, medal ? { color: medal.fg } : null]}>{player.rank}</Text>
      </View>
      <View style={styles.playerMain}>
        <Text style={styles.playerName} numberOfLines={1}>
          {player.name}
          {player.isMe ? <Text style={styles.playerYou}> (you)</Text> : null}
        </Text>
        <Text style={styles.playerMeta}>{player.exp} EXP</Text>
      </View>
      <Text style={styles.playerLevel}>LV {player.level}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingHorizontal: SIDE,
  },
  pageTitle: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  pageSubtitle: {
    color: Colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: WebTheme.shadowColor,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  levelBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: WebTheme.accentSolid,
    alignItems: 'center',
    justifyContent: 'center',
    ...accentShadow,
  },
  levelBadgeSmall: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    opacity: 0.9,
  },
  levelBadgeNum: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 26,
  },
  levelBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  levelTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  levelLoading: {
    alignSelf: 'flex-start',
  },
  bar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fde68a',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
    overflow: 'hidden',
  },
  levelMeta: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    flexShrink: 1,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  gameCard: {
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  gameCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#1c1917',
  },
  gameBody: {
    padding: 10,
    gap: 4,
  },
  gameName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  gameDesc: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    minHeight: 32,
  },
  gameFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 4,
  },
  gameRecord: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  playCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  playText: {
    color: WebTheme.softText,
    fontSize: 13,
    fontWeight: '800',
  },
  topCard: {
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: 6,
  },
  topLoading: {
    paddingVertical: 18,
  },
  topEmpty: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 18,
  },
  topDivider: {
    height: 1,
    marginHorizontal: 14,
    backgroundColor: Colors.border,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  playerRowMe: {
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
  },
  rank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
  },
  rankText: {
    color: Colors.textMuted,
    fontWeight: '800',
    fontSize: 13,
  },
  playerMain: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  playerYou: {
    color: Colors.textMuted,
    fontWeight: '600',
  },
  playerMeta: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  playerLevel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
});
// .
