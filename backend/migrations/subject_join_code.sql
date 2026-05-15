-- Subject join codes (Google Classroom–style enrollment).
-- Run once in Supabase SQL Editor.

ALTER TABLE IF EXISTS public.subjects
  ADD COLUMN IF NOT EXISTS join_code text,
  ADD COLUMN IF NOT EXISTS created_by_teacher_id_number text;

CREATE UNIQUE INDEX IF NOT EXISTS subjects_join_code_unique
  ON public.subjects (join_code)
  WHERE join_code IS NOT NULL;

COMMENT ON COLUMN public.subjects.join_code IS 'Unique code students enter to enroll (e.g. PROG-7X9A).';
COMMENT ON COLUMN public.subjects.created_by_teacher_id_number IS 'Owner teacher id_number; single owner per subject row.';
