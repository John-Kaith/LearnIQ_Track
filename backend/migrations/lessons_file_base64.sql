-- Store lesson PDF/PPTX bytes in Postgres (no local uploads/lessons file required).
-- Run once in Supabase SQL Editor.

alter table if exists public.lessons
  add column if not exists file_base64 text;

comment on column public.lessons.file_base64 is
  'Standard base64 of the uploaded lesson file. When set, storage_path / uploads/lessons may be empty.';
