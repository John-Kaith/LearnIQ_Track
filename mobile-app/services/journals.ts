import { apiRequest } from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';
import type { JournalDraft, JournalEntry } from '@/data/studentJournalMock';

/**
 * `POST /submit-journal` (backend/main.py) takes a single `body` string plus an
 * optional `attendance_id`. The mock's 4-field draft (tasks/skills/challenges/notes)
 * is formatted into one string here so no backend/DB change is needed.
 */

function requireStudentIdNumber(): string {
  const idNumber = useAuthStore.getState().user?.id_number;
  if (!idNumber) throw new Error('You must be signed in to submit a journal.');
  return idNumber;
}

function formatDraftAsBody(draft: JournalDraft): string {
  const sections = [
    ['Tasks Completed', draft.tasks],
    ['Skills Learned', draft.skills],
    ['Challenges Encountered', draft.challenges],
    ['Additional Notes', draft.notes],
  ] as const;
  return sections
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `${label}:\n${value.trim()}`)
    .join('\n\n');
}

/** Splits the concatenated `body` back into the 4 UI fields for display. */
function parseBodyToFields(body: string): Pick<JournalEntry, 'tasks' | 'skills' | 'challenges' | 'notes'> {
  const sectionLabels = ['Tasks Completed', 'Skills Learned', 'Challenges Encountered', 'Additional Notes'];
  const result: Record<string, string> = { tasks: '', skills: '', challenges: '', notes: '' };
  const keys = ['tasks', 'skills', 'challenges', 'notes'];
  sectionLabels.forEach((label, i) => {
    const pattern = new RegExp(`${label}:\\n([\\s\\S]*?)(?=\\n\\n[A-Z]|$)`);
    const match = body.match(pattern);
    if (match) result[keys[i]] = match[1].trim();
  });
  return result as Pick<JournalEntry, 'tasks' | 'skills' | 'challenges' | 'notes'>;
}

// The `journals` table is written via a few column-name fallbacks server-side
// (backend/db_supabase.py insert_journal_linked) — `journal_text` is the primary
// one, `body` is a legacy fallback. Read whichever is present.
type RawJournal = {
  id: string;
  journal_text?: string;
  body?: string;
  submitted_at?: string;
  created_at?: string;
  entry_date?: string;
  attendance_id?: string;
};

function toJournalEntry(raw: RawJournal): JournalEntry {
  const text = raw.journal_text ?? raw.body ?? '';
  const timestampIso = raw.submitted_at ?? raw.created_at;
  const submittedDate = timestampIso ? new Date(timestampIso) : null;
  const dateLabel =
    submittedDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) ??
    raw.entry_date ??
    '';
  const submittedAt = submittedDate
    ? `${dateLabel} • ${submittedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
    : undefined;
  return {
    id: String(raw.id),
    dateLabel,
    status: 'submitted',
    submittedAt,
    immersionLogId: raw.attendance_id ? String(raw.attendance_id) : undefined,
    ...parseBodyToFields(text),
  };
}

export async function fetchJournalHistory(): Promise<JournalEntry[]> {
  const studentIdNumber = requireStudentIdNumber();
  const rows = await apiRequest<RawJournal[]>('/journals', {
    query: { student_id_number: studentIdNumber },
  });
  return (rows ?? []).map(toJournalEntry);
}

export async function fetchJournalById(id: string): Promise<JournalEntry | null> {
  const entries = await fetchJournalHistory();
  return entries.find((j) => j.id === id) ?? null;
}

export async function submitJournal(
  draft: JournalDraft,
  attendanceId?: string,
): Promise<JournalEntry> {
  const row = await apiRequest<RawJournal>('/submit-journal', {
    method: 'POST',
    body: {
      body: formatDraftAsBody(draft),
      ...(attendanceId ? { attendance_id: attendanceId } : {}),
    },
  });
  return toJournalEntry(row);
}

export type { JournalDraft, JournalEntry };
