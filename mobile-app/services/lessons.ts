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

const DEFAULT_REVIEWER =
  'Reviewer content for this lesson. Your teacher will publish detailed notes here.';

const DEFAULT_QUIZ: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'Which statement best summarizes this lesson?',
    choices: [
      { id: 'a', label: 'Option A' },
      { id: 'b', label: 'Option B' },
      { id: 'c', label: 'Option C' },
      { id: 'd', label: 'Option D' },
    ],
  },
];

const DEFAULT_ACTIVITIES: ActivityItem[] = [
  { id: 'act-default-1', title: 'Written Response', type: 'Essay' },
  { id: 'act-default-2', title: 'Lesson Reflection', type: 'Reflection' },
];

const USE_MOCK = true;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchSubjectTitle(subjectId: string): Promise<string> {
  if (USE_MOCK) {
    await delay(100);
    return getSubjectTitle(subjectId);
  }
  // Future: apiRequest(`/subjects/${subjectId}`)
  return getSubjectTitle(subjectId);
}

export async function fetchSubjectLessons(subjectId: string): Promise<LessonSummary[]> {
  if (USE_MOCK) {
    await delay(150);
    return lessonsBySubject[subjectId] ?? [];
  }
  // Future: apiRequest(`/subjects/${subjectId}/lessons`)
  return [];
}

export async function fetchLessonDetail(lessonId: string): Promise<LessonDetail | null> {
  if (USE_MOCK) {
    await delay(150);
    return lessonDetails[lessonId] ?? null;
  }
  // Future: apiRequest(`/lessons/${lessonId}`)
  return null;
}

export async function fetchLessonReviewer(lessonId: string): Promise<string> {
  if (USE_MOCK) {
    await delay(150);
    return (
      reviewerByLesson[lessonId] ??
      'Reviewer content will appear here once your teacher publishes it.'
    );
  }
  // Future: lesson_content.reviewer
  return '';
}

export async function fetchLessonQuiz(lessonId: string): Promise<QuizQuestion[]> {
  if (USE_MOCK) {
    await delay(150);
    return quizByLesson[lessonId] ?? DEFAULT_QUIZ;
  }
  // Future: lesson_content.quiz
  return [];
}

export async function fetchLessonActivities(lessonId: string): Promise<ActivityItem[]> {
  if (USE_MOCK) {
    await delay(150);
    return activitiesByLesson[lessonId] ?? DEFAULT_ACTIVITIES;
  }
  // Future: lesson_content.activities
  return [];
}

export type { ActivityItem, LessonDetail, LessonSummary, QuizQuestion };
