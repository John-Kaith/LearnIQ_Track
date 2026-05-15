-- Time Out photo + GPS (run in Supabase SQL Editor if not applied yet).
alter table if exists public.attendance_logs
  add column if not exists time_out_photo_path text,
  add column if not exists time_out_latitude double precision,
  add column if not exists time_out_longitude double precision,
  add column if not exists time_out_readable_location_name text,
  add column if not exists time_out_capture_timestamp timestamptz;

NOTIFY pgrst, 'reload schema';
