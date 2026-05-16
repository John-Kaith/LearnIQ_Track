-- Run in Supabase → SQL Editor before deleting the local `uploads/` folder.
-- Safe to delete uploads only when ALL counts below are 0 (or you accept losing those rows' files).

-- 1) Lessons that have no bytes in DB (still depend on uploads/lessons or legacy disk if you ever used storage_path).
--    Fix: re-upload each lesson from the teacher UI (or backfill file_base64 from files on disk).
select count(*)::int as lessons_without_file_base64
from public.lessons
where coalesce(trim(file_base64), '') = '';

-- 2) Immersion Time In: path set in DB but no base64 (photo only on disk under uploads/immersion).
select count(*)::int as immersion_time_in_path_only
from public.attendance_logs
where coalesce(trim(captured_photo_path), '') <> ''
  and coalesce(trim(captured_photo_base64), '') = '';

-- 3) Immersion Time Out: path only, no base64 in DB.
select count(*)::int as immersion_time_out_path_only
from public.attendance_logs
where coalesce(trim(time_out_photo_path), '') <> ''
  and coalesce(trim(time_out_photo_base64), '') = '';
