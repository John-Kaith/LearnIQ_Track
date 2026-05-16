export type StudentSubject = {
  id: string;
  title: string;
  lessonCount: number;
};

export const studentLearnMock = {
  subjects: [
    { id: '1', title: 'GENERAL BIOLOGY 1', lessonCount: 9 },
    { id: '2', title: 'GENERAL BIOLOGY 2', lessonCount: 7 },
    { id: '3', title: 'RESEARCH IN DAILY LIFE 1', lessonCount: 1 },
    { id: '4', title: 'RESEARCH IN DAILY LIFE 2', lessonCount: 1 },
  ] satisfies StudentSubject[],
};
