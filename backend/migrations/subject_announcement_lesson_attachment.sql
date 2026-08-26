-- Class Stream: let a post optionally attach one of the teacher's lessons
-- (shown as a file card under the caption, like Google Classroom).
-- Run once in Supabase SQL editor (after subject_announcements.sql).

alter table public.subject_announcements
  add column if not exists lesson_id uuid references public.lessons(id) on delete set null;
