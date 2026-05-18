export type TeacherSubjectItem = {
  id: string;
  name: string;
  studentCount: number;
};

export type TeacherQuickAction = {
  id: string;
  label: string;
  icon: 'cloud-upload-outline' | 'journal-outline' | 'list-outline';
  color: string;
};

export const teacherHomeMock = {
  teacherName: 'Teacher Kaith',
  subtitle: 'Manage your classes and monitor students.',
  stats: {
    subjects: 4,
    publishedLessons: 12,
    students: 128,
    immersionAlerts: 3,
  },
  subjects: [
    { id: 'bio1', name: 'GENERAL BIOLOGY 1', studentCount: 35 },
    { id: 'ridl', name: 'RESEARCH IN DAILY LIFE', studentCount: 28 },
  ] satisfies TeacherSubjectItem[],
  immersion: {
    activeStudents: 3,
    pendingJournals: 2,
  },
  quickActions: [
    { id: 'upload', label: 'Upload Lesson', icon: 'cloud-upload-outline', color: '#60a5fa' },
    { id: 'journals', label: 'Review Journals', icon: 'journal-outline', color: '#a78bfa' },
    { id: 'attendance', label: 'Attendance Logs', icon: 'list-outline', color: '#34d399' },
  ] satisfies TeacherQuickAction[],
};
