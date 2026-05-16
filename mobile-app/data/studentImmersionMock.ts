export type AttendanceLogEntry = {
  id: string;
  month: string;
  day: string;
  dateLabel: string;
  timeIn: string;
  timeOut: string;
  totalHours: number;
};

export const studentImmersionMock = {
  progress: {
    completedHours: 120,
    requiredHours: 600,
    remainingHours: 480,
    percentComplete: 20,
  },
  todayDate: 'May 21, 2025',
  attendance: {
    timeIn: null as string | null,
    timeOut: null as string | null,
    totalHours: 0,
    timeInStatus: 'Not yet time in',
    timeOutStatus: 'Not yet time out',
  },
  recentLogs: [
    {
      id: '1',
      month: 'MAY',
      day: '20',
      dateLabel: 'Tuesday, May 20, 2025',
      timeIn: '8:00 AM',
      timeOut: '5:00 PM',
      totalHours: 8.0,
    },
    {
      id: '2',
      month: 'MAY',
      day: '19',
      dateLabel: 'Monday, May 19, 2025',
      timeIn: '8:05 AM',
      timeOut: '5:10 PM',
      totalHours: 9.1,
    },
    {
      id: '3',
      month: 'MAY',
      day: '16',
      dateLabel: 'Friday, May 16, 2025',
      timeIn: '8:10 AM',
      timeOut: '5:05 PM',
      totalHours: 8.9,
    },
  ] satisfies AttendanceLogEntry[],
  info: {
    company: 'Not set',
    supervisor: 'Not set',
    requiredHours: 600,
  },
};
