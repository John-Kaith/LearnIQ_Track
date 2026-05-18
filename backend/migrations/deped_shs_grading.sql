-- DepEd SHS grading (Table 5) — run in Supabase SQL Editor
-- (User may have already applied these ALTERs manually.)

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS deped_category text NOT NULL DEFAULT 'academic_standard';

ALTER TABLE public.subjects
  DROP CONSTRAINT IF EXISTS subjects_deped_category_check;

ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_deped_category_check
  CHECK (deped_category IN ('core', 'academic_standard', 'academic_specialized'));

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS grading_component text;

ALTER TABLE public.lessons
  DROP CONSTRAINT IF EXISTS lessons_grading_component_check;

ALTER TABLE public.lessons
  ADD CONSTRAINT lessons_grading_component_check
  CHECK (
    grading_component IS NULL
    OR grading_component IN ('written_work', 'performance_task', 'quarterly_assessment')
  );

ALTER TABLE public.student_grades
  ADD COLUMN IF NOT EXISTS written_work_score numeric,
  ADD COLUMN IF NOT EXISTS performance_task_score numeric,
  ADD COLUMN IF NOT EXISTS quarterly_assessment_score numeric,
  ADD COLUMN IF NOT EXISTS final_is_manual boolean NOT NULL DEFAULT false;
