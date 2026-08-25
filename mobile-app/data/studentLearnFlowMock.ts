export type LessonSummary = {
  id: string;
  subjectId: string;
  number: number;
  title: string;
};

export type LessonDetail = {
  id: string;
  subjectId: string;
  title: string;
  teacherName: string;
  publishedDate: string;
  description: string;
};

export type QuizChoice = {
  id: string;
  label: string;
};

export type QuizQuestion = {
  id: string;
  question: string;
  choices: QuizChoice[];
  /** Matches one of `choices[].id` (e.g. 'a'). */
  correctChoiceId: string;
};

export type FlashcardPair = { front: string; back: string };

export type ActivityItem =
  | { id: string; title: string; type: 'Essay'; question: string; sampleAnswer: string }
  | { id: string; title: string; type: 'Flashcards'; cards: FlashcardPair[] };

const SUBJECT_TITLES: Record<string, string> = {
  '1': 'GENERAL BIOLOGY 1',
  '2': 'GENERAL BIOLOGY 2',
  '3': 'RESEARCH IN DAILY LIFE 1',
  '4': 'RESEARCH IN DAILY LIFE 2',
};

export function getSubjectTitle(subjectId: string): string {
  return SUBJECT_TITLES[subjectId] ?? 'Subject';
}

export const lessonsBySubject: Record<string, LessonSummary[]> = {
  '1': [
    { id: 'les-1', subjectId: '1', number: 1, title: 'Cell Structure' },
    { id: 'les-2', subjectId: '1', number: 2, title: 'DNA & RNA' },
    { id: 'les-3', subjectId: '1', number: 3, title: 'Genetics' },
  ],
  '2': [
    { id: 'les-4', subjectId: '2', number: 1, title: 'Ecology Basics' },
    { id: 'les-5', subjectId: '2', number: 2, title: 'Evolution' },
  ],
  '3': [
    { id: 'les-6', subjectId: '3', number: 1, title: 'Research Methods' },
  ],
  '4': [
    { id: 'les-7', subjectId: '4', number: 1, title: 'Data Analysis' },
  ],
};

export const lessonDetails: Record<string, LessonDetail> = {
  'les-1': {
    id: 'les-1',
    subjectId: '1',
    title: 'Cell Structure',
    teacherName: 'Ms. Ana Reyes',
    publishedDate: 'May 10, 2025',
    description: 'Learn the structure and function of cells.',
  },
  'les-2': {
    id: 'les-2',
    subjectId: '1',
    title: 'DNA & RNA',
    teacherName: 'Ms. Ana Reyes',
    publishedDate: 'May 12, 2025',
    description: 'Explore nucleic acids and how genetic information is stored and expressed.',
  },
  'les-3': {
    id: 'les-3',
    subjectId: '1',
    title: 'Genetics',
    teacherName: 'Ms. Ana Reyes',
    publishedDate: 'May 15, 2025',
    description: 'Understand inheritance patterns and genetic variation.',
  },
  'les-4': {
    id: 'les-4',
    subjectId: '2',
    title: 'Ecology Basics',
    teacherName: 'Mr. Santos',
    publishedDate: 'May 8, 2025',
    description: 'Study ecosystems, populations, and environmental interactions.',
  },
  'les-5': {
    id: 'les-5',
    subjectId: '2',
    title: 'Evolution',
    teacherName: 'Mr. Santos',
    publishedDate: 'May 14, 2025',
    description: 'Learn about natural selection and species adaptation.',
  },
  'les-6': {
    id: 'les-6',
    subjectId: '3',
    title: 'Research Methods',
    teacherName: 'Ms. Cruz',
    publishedDate: 'May 5, 2025',
    description: 'Introduction to qualitative and quantitative research approaches.',
  },
  'les-7': {
    id: 'les-7',
    subjectId: '4',
    title: 'Data Analysis',
    teacherName: 'Ms. Cruz',
    publishedDate: 'May 6, 2025',
    description: 'Analyze research data using basic statistical tools.',
  },
};

export const reviewerByLesson: Record<string, string> = {
  'les-1': `## Cell Structure — Reviewer

**Learning objectives**
- Identify parts of a cell and their functions
- Compare plant and animal cells
- Explain how organelles support life processes

**Key concepts**
- Nucleus: control center; contains genetic material
- Mitochondria: ATP production (cellular respiration)
- Cell membrane: selective permeability

**Study tip**
Draw and label a typical animal cell, then note one function per organelle.`,
  'les-2': `## DNA & RNA — Reviewer

DNA stores genetic information; RNA helps express it through transcription and translation.

**Remember**
- DNA: double helix, deoxyribose, thymine
- RNA: single strand, ribose, uracil

Practice base-pairing rules before your quiz.`,
  'les-3': `## Genetics — Reviewer

Review Mendelian inheritance, dominant/recessive alleles, and Punnett squares.

Work through sample monohybrid cross problems.`,
};

export const quizByLesson: Record<string, QuizQuestion[]> = {
  'les-1': [
    {
      id: 'q1',
      question: 'Which organelle is known as the powerhouse of the cell?',
      choices: [
        { id: 'a', label: 'Nucleus' },
        { id: 'b', label: 'Mitochondria' },
        { id: 'c', label: 'Ribosome' },
        { id: 'd', label: 'Golgi apparatus' },
      ],
      correctChoiceId: 'b',
    },
  ],
};

// USE_MOCK is always false in services/lessons.ts (real backend only) — this
// stays empty rather than out of sync with the real ActivityItem shape.
export const activitiesByLesson: Record<string, ActivityItem[]> = {};
