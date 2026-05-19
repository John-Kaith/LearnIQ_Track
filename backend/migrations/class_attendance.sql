-- Class attendance (photo check-in per subject session). Separate from immersion attendance_logs.
-- Run in Supabase SQL editor.

create table if not exists public.class_attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  teacher_id_number text not null,
  session_date date not null default (current_date),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create unique index if not exists class_attendance_sessions_subject_day
  on public.class_attendance_sessions (subject_id, session_date);

create index if not exists class_attendance_sessions_teacher_idx
  on public.class_attendance_sessions (teacher_id_number, session_date desc);

create table if not exists public.class_attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_attendance_sessions (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  student_id_number text,
  time_in timestamptz not null default now(),
  status text not null default 'present',
  captured_photo_base64 text,
  latitude double precision,
  longitude double precision,
  readable_location_name text,
  capture_timestamp timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create index if not exists class_attendance_records_session_idx
  on public.class_attendance_records (session_id, time_in desc);

notify pgrst, 'reload schema';
