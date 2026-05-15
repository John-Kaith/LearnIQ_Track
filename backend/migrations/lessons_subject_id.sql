-- Link lessons to subjects (required for teacher subject pages).
-- Run once in Supabase SQL Editor.

alter table if exists public.lessons
  add column if not exists subject_id uuid references public.subjects (id) on delete set null;

create index if not exists lessons_subject_id_idx on public.lessons (subject_id);
