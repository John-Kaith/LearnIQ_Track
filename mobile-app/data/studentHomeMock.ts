export const studentHomeMock = {
  greeting: 'Good afternoon,',
  name: 'John Kaith!',
  subtitle: 'Keep learning, keep growing. 🚀',
  stats: {
    subjects: 12,
    lessons: 36,
    completed: 18,
    streak: 7,
  },
  continueLearning: {
    grade: 'Grade 12',
    subject: 'General Mathematics',
    lesson: 'Quadratic Equations',
    progress: 60,
  },
  quickAccess: [
    { id: 'lessons', label: 'My Lessons', icon: 'book-outline' as const, color: '#fbbf24' },
    { id: 'leaderboard', label: 'Leaderboard', icon: 'trophy-outline' as const, color: '#ca8a04' },
    { id: 'history', label: 'History', icon: 'time-outline' as const, color: '#f87171' },
    { id: 'modules', label: 'Module Selection', icon: 'grid-outline' as const, color: '#34d399' },
  ],
  immersion: {
    timeIn: 'May 20, 2025 • 08:00 AM',
    timeOut: 'May 20, 2025 • 05:00 PM',
  },
  leaderboard: {
    rank: 1,
    label: '🏆 #1 You',
    xp: '2,450 XP',
  },
};
