import { apiRequest } from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';

export type TeacherSubject = {
  id: string;
  name: string;
  description: string;
  color: string;
  joinCode: string | null;
  publishedLessonCount: number;
  totalLessonCount: number;
};

export type TeacherLessonSummary = {
  id: string;
  title: string;
  fileType: string;
  published: boolean;
  createdAt: string | null;
  subjectId: string | null;
};

type RawSubject = {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  join_code?: string | null;
  published_lesson_count?: number;
  total_lesson_count?: number;
};

type RawTeacherLesson = {
  id: string;
  filename: string;
  file_type: string;
  published: boolean;
  created_at: string | null;
  subject_id: string | null;
};

function requireTeacherIdNumber(): string {
  const idNumber = useAuthStore.getState().user?.id_number;
  if (!idNumber) throw new Error('You must be signed in to view subjects.');
  return idNumber;
}

function filenameToTitle(filename: string): string {
  return filename.replace(/\.[a-zA-Z0-9]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Untitled lesson';
}

function toTeacherSubject(row: RawSubject): TeacherSubject {
  return {
    id: String(row.id),
    name: row.name || 'Untitled subject',
    description: row.description || '',
    color: row.color || '#ca8a04',
    joinCode: row.join_code ?? null,
    publishedLessonCount: row.published_lesson_count ?? 0,
    totalLessonCount: row.total_lesson_count ?? 0,
  };
}

// Simple in-module cache, mirroring services/lessons.ts's pattern — a
// subject-detail screen navigated to right after the list screen shouldn't
// need a second round trip just to resolve the subject's own name/color.
let subjectsCache: TeacherSubject[] | null = null;

export async function fetchTeacherSubjects(): Promise<TeacherSubject[]> {
  const teacherId = requireTeacherIdNumber();
  const data = await apiRequest<{ subjects: RawSubject[] }>('/subjects', {
    query: { owner_teacher_id_number: teacherId },
  });
  const subjects = (data.subjects ?? []).map(toTeacherSubject);
  subjectsCache = subjects;
  return subjects;
}

export async function fetchTeacherSubjectById(subjectId: string): Promise<TeacherSubject | null> {
  const subjects = subjectsCache ?? (await fetchTeacherSubjects());
  return subjects.find((s) => s.id === subjectId) ?? null;
}

/**
 * `/teacher/lessons` returns every lesson the teacher owns across all
 * subjects (no subject_id filter server-side) — filter client-side by the
 * subject_id already present on each row.
 */
export async function fetchTeacherLessonsForSubject(subjectId: string): Promise<TeacherLessonSummary[]> {
  const teacherId = requireTeacherIdNumber();
  const data = await apiRequest<{ lessons: RawTeacherLesson[] }>('/teacher/lessons', {
    query: { teacher_id_number: teacherId },
  });
  return (data.lessons ?? [])
    .filter((l) => String(l.subject_id ?? '') === subjectId)
    .map((l) => ({
      id: String(l.id),
      title: filenameToTitle(l.filename || ''),
      fileType: (l.file_type || '').toUpperCase(),
      published: Boolean(l.published),
      createdAt: l.created_at,
      subjectId: l.subject_id ? String(l.subject_id) : null,
    }))
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
}
