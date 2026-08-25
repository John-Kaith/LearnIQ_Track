-- Class Stream: text-only announcements a teacher posts to a subject,
-- visible to enrolled students and the teacher. See main.py
-- POST/GET /subjects/{subject_id}/announcements.
-- Run once in Supabase SQL editor.

create table if not exists public.subject_announcements (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_id_number text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists subject_announcements_subject_id_idx
  on public.subject_announcements (subject_id, created_at desc);
