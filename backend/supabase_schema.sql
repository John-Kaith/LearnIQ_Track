-- Run this in Supabase SQL Editor (once) before using the API.

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  last_name text not null,
  first_name text not null,
  middle_name text,
  name_suffix text,
  id_number text not null unique,
  email text not null unique,
  password text not null,
  role text not null default 'student',
  approval_status text not null default 'pending',
  created_at timestamptz default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.profiles (id) on delete set null,
  teacher_id_number text,
  filename text not null,
  file_type text,
  extracted_text text,
  is_published boolean not null default false,
  storage_path text,
  created_at timestamptz default now()
);

create table if not exists public.lesson_content (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  reviewer text,
  quiz jsonb not null default '[]'::jsonb,
  activities jsonb,
  unique (lesson_id)
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles (id) on delete set null,
  student_id_number text,
  lesson_id uuid references public.lessons (id) on delete cascade,
  score int,
  total_questions int,
  answers jsonb,
  created_at timestamptz default now()
);

create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles (id) on delete set null,
  student_id_number text,
  time_in timestamptz,
  time_out timestamptz,
  total_hours numeric(6,2),
  status text not null default 'active',
  event_type text,
  logged_at timestamptz default now()
);

create table if not exists public.journals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles (id) on delete set null,
  student_id_number text,
  attendance_id uuid references public.attendance_logs (id) on delete set null,
  body text not null,
  entry_date date default (current_date),
  created_at timestamptz default now()
);

-- Safe updates for existing projects (run even if tables already exist).
alter table if exists public.attendance_logs
  add column if not exists time_in timestamptz,
  add column if not exists time_out timestamptz,
  add column if not exists total_hours numeric(6,2),
  add column if not exists status text default 'active',
  add column if not exists date date default (current_date),
  alter column event_type drop not null;

-- Immersion Time In: verified photo + GPS capture (run in Supabase SQL editor).
alter table if exists public.attendance_logs
  add column if not exists captured_photo_path text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists readable_location_name text,
  add column if not exists capture_timestamp timestamptz;

-- Immersion Time Out: verified photo + GPS capture (run in Supabase SQL editor).
alter table if exists public.attendance_logs
  add column if not exists time_out_photo_path text,
  add column if not exists time_out_latitude double precision,
  add column if not exists time_out_longitude double precision,
  add column if not exists time_out_readable_location_name text,
  add column if not exists time_out_capture_timestamp timestamptz;

alter table if exists public.journals
  add column if not exists attendance_id uuid references public.attendance_logs (id) on delete set null;

alter table if exists public.lessons
  add column if not exists subject_id uuid references public.subjects (id) on delete set null;

-- Editable profile fields (bio, contact, avatar). Safe for existing installs.
alter table if exists public.profiles
  add column if not exists bio text,
  add column if not exists phone text,
  add column if not exists section text,
  add column if not exists dob date,
  add column if not exists address text,
  add column if not exists avatar_data text;

-- Student signup (SHS): name parts, year level, strand
alter table if exists public.profiles
  add column if not exists last_name text,
  add column if not exists first_name text,
  add column if not exists middle_name text,
  add column if not exists name_suffix text,
  add column if not exists grade_level text,
  add column if not exists strand text;
