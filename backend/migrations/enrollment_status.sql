-- Student enrollment visibility: active | archived | unenrolled
-- Run in Supabase SQL editor after deploy.

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS enrollment_status text NOT NULL DEFAULT 'active';

COMMENT ON COLUMN enrollments.enrollment_status IS
  'active = default; archived = still on My subjects; unenrolled = hidden from My subjects, listed under Archived';

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
