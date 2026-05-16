-- Store Time In / Time Out verification photos in the database (optional disk paths remain for legacy rows).
-- Run in Supabase → SQL Editor after immersion_attendance_capture.sql and immersion_time_out_capture.sql.

alter table if exists public.attendance_logs
  add column if not exists captured_photo_base64 text,
  add column if not exists time_out_photo_base64 text;

NOTIFY pgrst, 'reload schema';
