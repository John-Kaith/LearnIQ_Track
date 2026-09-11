-- Student activity answers and scores.
-- Run once in the Supabase SQL Editor; safe to re-run.

create table if not exists public.activity_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  activity_index integer not null default 0,
  activity_type text not null default 'essay',
  response jsonb,
  score numeric(6,2),
  submitted_at timestamptz not null default now()
);

create index if not exists activity_attempts_student_id_idx
  on public.activity_attempts(student_id, submitted_at desc);

create index if not exists activity_attempts_lesson_id_idx
  on public.activity_attempts(lesson_id, submitted_at desc);
