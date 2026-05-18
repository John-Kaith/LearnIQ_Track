import {
  initialJournalHistory,
  type JournalDraft,
  type JournalEntry,
} from '@/data/studentJournalMock';

const USE_MOCK = true;

let mockJournals: JournalEntry[] = [...initialJournalHistory];

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchJournalHistory(): Promise<JournalEntry[]> {
  if (USE_MOCK) {
    await delay(150);
    return [...mockJournals];
  }
  // Future: apiRequest('/student/journals')
  return [];
}

export async function fetchJournalById(id: string): Promise<JournalEntry | null> {
  if (USE_MOCK) {
    await delay(100);
    return mockJournals.find((j) => j.id === id) ?? null;
  }
  // Future: apiRequest(`/journals/${id}`)
  return null;
}

export async function submitJournal(draft: JournalDraft): Promise<JournalEntry> {
  if (USE_MOCK) {
    await delay(400);
    const entry: JournalEntry = {
      id: `j-${Date.now()}`,
      dateLabel: 'May 21, 2025',
      status: 'submitted',
      submittedAt: 'May 21, 2025 • Just now',
      immersionLogId: undefined,
      tasks: draft.tasks.trim(),
      skills: draft.skills.trim(),
      challenges: draft.challenges.trim(),
      notes: draft.notes.trim(),
    };
    mockJournals = [entry, ...mockJournals.filter((j) => j.dateLabel !== entry.dateLabel)];
    return entry;
  }
  // Future: POST /journals { journal_text, immersion_log_id, ... }
  throw new Error('Not implemented');
}

export type { JournalDraft, JournalEntry };
