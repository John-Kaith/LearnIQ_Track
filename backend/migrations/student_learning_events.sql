-- Student learning history (reviewer opens, activity views) for History page.
-- Quiz history is read from quiz_attempts; this table covers reviewer + activity.

create table if not exists public.student_learning_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles (id) on delete cascade,
  student_id_number text,
  lesson_id uuid references public.lessons (id) on delete set null,
  event_type text not null,
  lesson_title text,
  subject_name text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists student_learning_events_student_id_idx
  on public.student_learning_events (student_id, created_at desc);

create index if not exists student_learning_events_student_idn_idx
  on public.student_learning_events (student_id_number, created_at desc);

alter table if exists public.student_learning_events
  drop constraint if exists student_learning_events_event_type_check;

alter table if exists public.student_learning_events
  add constraint student_learning_events_event_type_check
  check (event_type in ('reviewer', 'activity'));
