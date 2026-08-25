-- Class attendance: add time_out so QR check-in becomes check-in/check-out
-- (first scan of the teacher's rotating QR = time in, second scan = time
-- out) instead of a single scan-and-done. Prevents a student from scanning
-- in and then leaving without it showing on the record.
-- Run once in Supabase SQL editor.

alter table if exists public.class_attendance_records
  add column if not exists time_out timestamptz;
