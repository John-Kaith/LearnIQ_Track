import { apiRequest } from '@/services/apiClient';

/**
 * `GET /me` (backend/main.py, Bearer token) — the profile fields not
 * already carried on the login session (adviser id, account created date).
 */
export type MyProfileExtra = {
  adviserIdNumber: string;
  createdAt: string | null;
};

type RawMyProfile = {
  adviser_id_number?: string;
  created_at?: string | null;
};

export async function fetchMyProfileExtra(): Promise<MyProfileExtra> {
  const raw = await apiRequest<RawMyProfile>('/me');
  return {
    adviserIdNumber: raw.adviser_id_number || '',
    createdAt: raw.created_at ?? null,
  };
}

/**
 * `GET /student/dashboard-stats` (backend/main.py, Bearer token — identifies
 * the student from the token, no id_number param needed).
 */
export type StudentDashboardStats = {
  totalPoints: number;
  pointsThisWeek: number;
  pointsWeekNote: string;
  quizAttempts: number;
  lessonsPracticed: number;
  progressPct: number;
  leaderboardRank: number | null;
  rankedStudentCount: number;
  rankNote: string;
  leaderboardPreview: { rank: number; displayName: string; totalPoints: number }[];
};

type RawStudentDashboardStats = {
  total_points?: number;
  points_this_week?: number;
  points_week_note?: string;
  quiz_attempts?: number;
  lessons_practiced?: number;
  progress_pct?: number;
  leaderboard_rank?: number | null;
  ranked_student_count?: number;
  rank_note?: string;
  leaderboard_preview?: { rank: number; display_name: string; total_points: number }[];
};

export async function fetchStudentDashboardStats(): Promise<StudentDashboardStats> {
  const raw = await apiRequest<RawStudentDashboardStats>('/student/dashboard-stats');
  return {
    totalPoints: raw.total_points ?? 0,
    pointsThisWeek: raw.points_this_week ?? 0,
    pointsWeekNote: raw.points_week_note ?? '',
    quizAttempts: raw.quiz_attempts ?? 0,
    lessonsPracticed: raw.lessons_practiced ?? 0,
    progressPct: raw.progress_pct ?? 0,
    leaderboardRank: raw.leaderboard_rank ?? null,
    rankedStudentCount: raw.ranked_student_count ?? 0,
    rankNote: raw.rank_note ?? '',
    leaderboardPreview: (raw.leaderboard_preview ?? []).map((e) => ({
      rank: e.rank,
      displayName: e.display_name,
      totalPoints: e.total_points,
    })),
  };
}

/**
 * `GET /teacher/dashboard-stats` (backend/main.py, Bearer token — see
 * db_supabase.get_teacher_learniq_dashboard_stats for the full field set;
 * only what the mobile Teacher Home screen needs is mapped here).
 */
export type TeacherDashboardStats = {
  subjectsCount: number;
  lessonsPublished: number;
  lessonsUploaded: number;
  enrolledStudents: number;
  quizAttemptsTotal: number;
};

type RawTeacherDashboardStats = {
  subjects_count?: number;
  lessons_published?: number;
  lessons_uploaded?: number;
  enrolled_students?: number;
  quiz_attempts_total?: number;
};

export async function fetchTeacherDashboardStats(): Promise<TeacherDashboardStats> {
  const raw = await apiRequest<RawTeacherDashboardStats>('/teacher/dashboard-stats');
  return {
    subjectsCount: raw.subjects_count ?? 0,
    lessonsPublished: raw.lessons_published ?? 0,
    lessonsUploaded: raw.lessons_uploaded ?? 0,
    enrolledStudents: raw.enrolled_students ?? 0,
    quizAttemptsTotal: raw.quiz_attempts_total ?? 0,
  };
}
