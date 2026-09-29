-- Student enrollment visibility: active | archived | unenrolled
-- Run in Supabase SQL editor after deploy.

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS enrollment_status text NOT NULL DEFAULT 'active';

COMMENT ON COLUMN enrollments.enrollment_status IS
  'active = default (My subjects); archived = moved to Archived, can be unarchived; unenrolled = listed under Archived, rejoin with class code';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_enrollment_status_check'
  ) THEN
    ALTER TABLE enrollments
      ADD CONSTRAINT enrollments_enrollment_status_check
      CHECK (enrollment_status IN ('active', 'archived', 'unenrolled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_enrollments_student_status
  ON enrollments (student_id, grading_period_id, enrollment_status);
-- .
