import { apiRequest } from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';

/** Word Clash keeps its own counters ("battles"); the other games share one shape. */
export type ArcadeGameRecord = {
  matches: number;
  wins: number;
  totalExp: number;
};

export type ArcadeStats = {
  level: number;
  totalExp: number;
  expIntoLevel: number;
  expPerLevel: number;
  /** Keyed by game id (`word-clash`, `sungka`, …); games never played are missing. */
  games: Record<string, ArcadeGameRecord>;
};

type RawArcadeStats = {
  level?: number;
  total_exp?: number;
  exp_into_level?: number;
  exp_per_level?: number;
  games?: Record<
    string,
    { battles?: number; matches?: number; wins?: number; total_exp?: number }
  >;
};

/** GET /student/arcade-stats — Arcade level (EXP from every game) and each game's record. */
export async function fetchArcadeStats(): Promise<ArcadeStats> {
  const idNumber = useAuthStore.getState().user?.id_number;
  if (!idNumber) throw new Error('Sign in required.');
  const raw = await apiRequest<RawArcadeStats>('/student/arcade-stats', {
    query: { student_id_number: idNumber },
  });
  const games: Record<string, ArcadeGameRecord> = {};
  for (const [id, g] of Object.entries(raw.games ?? {})) {
    games[id] = {
      matches: Number(g.matches ?? g.battles ?? 0),
      wins: Number(g.wins ?? 0),
      totalExp: Number(g.total_exp ?? 0),
    };
  }
  return {
    level: Number(raw.level ?? 0),
    totalExp: Number(raw.total_exp ?? 0),
    expIntoLevel: Number(raw.exp_into_level ?? 0),
    expPerLevel: Number(raw.exp_per_level ?? 100) || 100,
    games,
  };
}

export type ArcadePlayer = {
  rank: number;
  name: string;
  idNumber: string;
  level: number;
  exp: number;
  isMe: boolean;
};

export type ArcadeTopPlayers = {
  /** e.g. "2026-2027" — the board counts this school year only. */
  schoolYear: string | null;
  players: ArcadePlayer[];
  /** The signed-in student's own row when they're ranked below the top list. */
  me: ArcadePlayer | null;
};

type RawLeaderboard = {
  school_year?: string | null;
  entries?: {
    display_name?: string;
    id_number?: string;
    arcade_level?: number;
    arcade_total_exp?: number;
    battle_level?: number;
    battle_total_exp?: number;
  }[];
};

/** Top Arcade players this school year, ranked by Arcade level then EXP (like the web Arcade). */
export async function fetchArcadeTopPlayers(limit = 5): Promise<ArcadeTopPlayers> {
  const me = useAuthStore.getState().user?.id_number ?? '';
  const raw = await apiRequest<RawLeaderboard>('/student/leaderboard', { query: { limit: 200 } });
  const ranked = (raw.entries ?? [])
    .map((e) => ({
      name: e.display_name || e.id_number || 'Student',
      idNumber: e.id_number ?? '',
      level: Number(e.arcade_level ?? e.battle_level ?? 0),
      exp: Number(e.arcade_total_exp ?? e.battle_total_exp ?? 0),
    }))
    .filter((p) => p.exp > 0)
    .sort((a, b) => b.level - a.level || b.exp - a.exp)
    .map((p, i) => ({ ...p, rank: i + 1, isMe: !!me && p.idNumber === me }));
  const mine = ranked.find((p) => p.isMe) ?? null;
  return {
    schoolYear: raw.school_year ?? null,
    players: ranked.slice(0, limit),
    me: mine && mine.rank > limit ? mine : null,
  };
}
// .
