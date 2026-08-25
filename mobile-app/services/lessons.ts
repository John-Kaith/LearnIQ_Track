import { apiRequest } from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';
import type { StudentSubject } from '@/data/studentLearnMock';
import {
  activitiesByLesson,
  getSubjectTitle,
  lessonDetails,
  lessonsBySubject,
  quizByLesson,
  reviewerByLesson,
  type ActivityItem,
  type LessonDetail,
  type LessonSummary,
  type QuizQuestion,
} from '@/data/studentLearnFlowMock';

const DEFAULT_QUIZ: QuizQuestion[] = [];
const DEFAULT_ACTIVITIES: ActivityItem[] = [];

const USE_MOCK = false;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function requireStudentIdNumber(): string {
  const idNumber = useAuthStore.getState().user?.id_number;
  if (!idNumber) throw new Error('You must be signed in to view lessons.');
  return idNumber;
}

/**
 * `GET /student/lessons` already embeds `reviewer`, `quiz`, and `activities` per
 * lesson (backend/db_supabase.py list_published_lessons_with_content) — one call
 * covers subject list, lesson list, and lesson content, so every fetch* function
 * below shares this cache instead of hitting `/get-content/{file_id}` separately.
 */
type RawLesson = {
  file_id: string;
  filename: string;
  file_type: string;
  created_at: string | null;
  reviewer: string;
  quiz: { question: string; choices: string[]; answer: string }[];
  activities: (| { activity_type: 'essay'; question: string; answer?: string }
    | { activity_type: 'flashcards'; cards: { front: string; back: string }[] })[];
  subject_id: string | null;
  subject_name: string;
  subject_color: string;
  teacher_id_number: string;
};

const lessonsById = new Map<string, RawLesson>();
const lessonsBySubjectCache = new Map<string, RawLesson[]>();
let subjectsCache: StudentSubject[] | null = null;
let subjectTeacherNameById = new Map<string, string>();

function cacheLessons(rows: RawLesson[]) {
  for (const row of rows) {
    lessonsById.set(row.file_id, row);
  }
}

async function fetchRawLessons(subjectId?: string): Promise<RawLesson[]> {
  const studentIdNumber = requireStudentIdNumber();
  const res = await apiRequest<{ lessons: RawLesson[] }>('/student/lessons', {
    query: { student_id_number: studentIdNumber, subject_id: subjectId },
  });
  const rows = res.lessons ?? [];
  cacheLessons(rows);
  if (subjectId) lessonsBySubjectCache.set(subjectId, rows);
  return rows;
}

async function fetchRawLessonById(lessonId: string): Promise<RawLesson | null> {
  if (lessonsById.has(lessonId)) return lessonsById.get(lessonId) ?? null;
  await fetchRawLessons();
  return lessonsById.get(lessonId) ?? null;
}

function filenameToTitle(filename: string): string {
  return filename.replace(/\.[a-zA-Z0-9]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Untitled Lesson';
}

function formatPublishedDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function toLessonSummary(row: RawLesson, index: number): LessonSummary {
  return {
    id: row.file_id,
    subjectId: row.subject_id ?? '',
    number: index + 1,
    title: filenameToTitle(row.filename),
  };
}

function toLessonDetail(row: RawLesson): LessonDetail {
  return {
    id: row.file_id,
    subjectId: row.subject_id ?? '',
    title: filenameToTitle(row.filename),
    teacherName: subjectTeacherNameById.get(row.subject_id ?? '') || 'Your teacher',
    publishedDate: formatPublishedDate(row.created_at),
    description: row.subject_name
      ? `Published lesson content for ${row.subject_name}.`
      : 'Published lesson content.',
  };
}

function toQuizQuestions(raw: RawLesson['quiz']): QuizQuestion[] {
  const letters = ['a', 'b', 'c', 'd'];
  return raw
    .filter((q) => q.question && Array.isArray(q.choices) && q.choices.length === 4)
    .map((q, index) => {
      // Backend normalizes `answer` to a single letter A-D (backend/main.py
      // _parse_and_normalize_quiz_json) matching choices[] by index.
      const letter = String(q.answer || '').trim().charAt(0).toLowerCase();
      const correctChoiceId = letters.includes(letter) ? letter : 'a';
      return {
        id: `q${index + 1}`,
        question: q.question,
        choices: q.choices.map((label, ci) => ({ id: letters[ci], label })),
        correctChoiceId,
      };
    });
}

function toActivityItems(raw: RawLesson['activities']): ActivityItem[] {
  const items: ActivityItem[] = [];
  raw.forEach((activity, index) => {
    if (activity.activity_type === 'flashcards' && activity.cards?.length) {
      const count = activity.cards.length;
      items.push({
        id: `act-${index}-flashcards`,
        title: `Flashcards (${count} card${count === 1 ? '' : 's'})`,
        type: 'Flashcards',
        cards: activity.cards.map((c) => ({ front: c.front, back: c.back })),
      });
    } else if (activity.activity_type === 'essay' && activity.question) {
      const title =
        activity.question.length > 70 ? `${activity.question.slice(0, 67)}...` : activity.question;
      items.push({
        id: `act-${index}-essay`,
        title,
        type: 'Essay',
        question: activity.question,
        sampleAnswer: activity.answer || 'No sample answer provided.',
      });
    }
  });
  return items;
}

export async function fetchStudentSubjects(): Promise<StudentSubject[]> {
  const studentIdNumber = requireStudentIdNumber();
  const res = await apiRequest<{
    subjects: {
      id: string;
      name: string;
      published_lesson_count?: number;
      teacher_name?: string;
    }[];
  }>('/student/subjects', { query: { student_id_number: studentIdNumber } });
  const subjects = res.subjects ?? [];
  subjectTeacherNameById = new Map(
    subjects.map((s) => [String(s.id), s.teacher_name || '']),
  );
  subjectsCache = subjects.map((s) => ({
    id: String(s.id),
    title: s.name || 'Subject',
    lessonCount: s.published_lesson_count ?? 0,
  }));
  return subjectsCache;
}

/**
 * `POST /subjects/join` (backend/main.py) — enrolls the signed-in student
 * via a teacher's class code. Clears the cached subject list so the next
 * fetchStudentSubjects() call picks up the newly-joined subject.
 */
export async function joinSubjectByCode(joinCode: string): Promise<{ subjectName: string }> {
  const studentIdNumber = requireStudentIdNumber();
  const code = joinCode.trim().toUpperCase();
  if (!code) throw new Error('Enter a class code.');
  const res = await apiRequest<{ subject?: { name?: string } }>('/subjects/join', {
    method: 'POST',
    body: { join_code: code, student_id_number: studentIdNumber },
  });
  subjectsCache = null;
  return { subjectName: res.subject?.name || 'the subject' };
}

export type LatestLesson = {
  subjectId: string;
  subjectTitle: string;
  lessonId: string;
  lessonTitle: string;
};

/**
 * Most-recently-published lesson across all of the student's subjects —
 * used for the Home screen's "Continue Learning" card. There is no
 * backend field for "last opened by this student", so the newest
 * published lesson is the closest honest proxy.
 */
export async function fetchLatestLessonForHome(): Promise<LatestLesson | null> {
  const rows = await fetchRawLessons();
  if (!rows.length) return null;
  const newest = [...rows].sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
  )[0];
  return {
    subjectId: newest.subject_id ?? '',
    subjectTitle: newest.subject_name || 'Subject',
    lessonId: newest.file_id,
    lessonTitle: filenameToTitle(newest.filename),
  };
}

export async function fetchSubjectTitle(subjectId: string): Promise<string> {
  if (USE_MOCK) {
    await delay(100);
    return getSubjectTitle(subjectId);
  }
  const subjects = subjectsCache ?? (await fetchStudentSubjects());
  return subjects.find((s) => s.id === subjectId)?.title ?? 'Subject';
}

export async function fetchSubjectLessons(subjectId: string): Promise<LessonSummary[]> {
  if (USE_MOCK) {
    await delay(150);
    return lessonsBySubject[subjectId] ?? [];
  }
  const rows = await fetchRawLessons(subjectId);
  const sorted = [...rows].sort(
    (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
  );
  return sorted.map(toLessonSummary);
}

export async function fetchLessonDetail(lessonId: string): Promise<LessonDetail | null> {
  if (USE_MOCK) {
    await delay(150);
    return lessonDetails[lessonId] ?? null;
  }
  const row = await fetchRawLessonById(lessonId);
  return row ? toLessonDetail(row) : null;
}

export async function fetchLessonReviewer(lessonId: string): Promise<string> {
  if (USE_MOCK) {
    await delay(150);
    return (
      reviewerByLesson[lessonId] ??
      'Reviewer content will appear here once your teacher publishes it.'
    );
  }
  const row = await fetchRawLessonById(lessonId);
  return row?.reviewer || 'Reviewer content will appear here once your teacher publishes it.';
}

export async function fetchLessonQuiz(lessonId: string): Promise<QuizQuestion[]> {
  if (USE_MOCK) {
    await delay(150);
    return quizByLesson[lessonId] ?? DEFAULT_QUIZ;
  }
  const row = await fetchRawLessonById(lessonId);
  return row ? toQuizQuestions(row.quiz) : DEFAULT_QUIZ;
}

/**
 * `POST /quiz-attempt` (backend/main.py) — the client computes the score
 * (comparing each question's `correctChoiceId` against what the student
 * picked) and just reports the tally; there's no server-side per-question
 * grading endpoint.
 */
export async function submitQuizAttempt(
  lessonId: string,
  questions: QuizQuestion[],
  selectedByQuestionId: Record<string, string>,
): Promise<{ score: number; totalQuestions: number }> {
  const studentIdNumber = requireStudentIdNumber();
  let score = 0;
  const answers = questions.map((q) => {
    const picked = selectedByQuestionId[q.id] ?? null;
    const correct = picked === q.correctChoiceId;
    if (correct) score += 1;
    return { question_id: q.id, picked, correct };
  });
  await apiRequest('/quiz-attempt', {
    method: 'POST',
    body: {
      lesson_id: lessonId,
      score,
      total_questions: questions.length,
      answers,
      student_id_number: studentIdNumber,
    },
  });
  return { score, totalQuestions: questions.length };
}

export async function fetchLessonActivities(lessonId: string): Promise<ActivityItem[]> {
  if (USE_MOCK) {
    await delay(150);
    return activitiesByLesson[lessonId] ?? DEFAULT_ACTIVITIES;
  }
  const row = await fetchRawLessonById(lessonId);
  return row ? toActivityItems(row.activities) : DEFAULT_ACTIVITIES;
}

export type { ActivityItem, LessonDetail, LessonSummary, QuizQuestion, StudentSubject };
