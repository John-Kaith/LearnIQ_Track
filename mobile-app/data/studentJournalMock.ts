export type JournalStatus = 'submitted' | 'missing';

export type JournalEntry = {
  id: string;
  dateLabel: string;
  status: JournalStatus;
  submittedAt?: string;
  immersionLogId?: string;
  tasks: string;
  skills: string;
  challenges: string;
  notes: string;
};

export type JournalDraft = {
  tasks: string;
  skills: string;
  challenges: string;
  notes: string;
};

export const MAX_FIELD_LENGTH = 500;

export const initialJournalHistory: JournalEntry[] = [
  {
    id: 'j-1',
    dateLabel: 'May 20, 2025',
    status: 'submitted',
    submittedAt: 'May 20, 2025 • 5:15 PM',
    immersionLogId: 'a2',
    tasks:
      'Assisted with inventory logging and shadowed the supervisor during client meetings.',
    skills: 'Improved communication skills and learned basic spreadsheet reporting.',
    challenges: 'Adjusting to the fast-paced office environment on busy days.',
    notes: 'Plan to request feedback from supervisor next week.',
  },
  {
    id: 'j-2',
    dateLabel: 'May 19, 2025',
    status: 'submitted',
    submittedAt: 'May 19, 2025 • 4:50 PM',
    immersionLogId: 'a3',
    tasks: 'Prepared daily reports and organized filing for the admin team.',
    skills: 'Time management and attention to detail when handling documents.',
    challenges: 'None significant today.',
    notes: '',
  },
  {
    id: 'j-3',
    dateLabel: 'May 18, 2025',
    status: 'missing',
    tasks: '',
    skills: '',
    challenges: '',
    notes: '',
  },
];
