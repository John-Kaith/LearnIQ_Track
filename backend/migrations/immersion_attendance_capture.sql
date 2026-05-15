-- Run this in Supabase → SQL Editor (required for photo + GPS Time In).
-- After running, wait ~30s or run: NOTIFY pgrst, 'reload schema';

alter table if exists public.attendance_logs
  add column if not exists captured_photo_path text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists readable_location_name text,
  add column if not exists capture_timestamp timestamptz;

NOTIFY pgrst, 'reload schema';
