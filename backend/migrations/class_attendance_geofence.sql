-- Geofence + teacher start location for class attendance (photo = present; location = badge only).
-- Run in Supabase SQL editor.

alter table public.subjects
  add column if not exists attendance_geofence_lat double precision,
  add column if not exists attendance_geofence_lon double precision,
  add column if not exists attendance_geofence_radius_m integer default 150,
  add column if not exists attendance_geofence_label text;

alter table public.class_attendance_sessions
  add column if not exists teacher_start_latitude double precision,
  add column if not exists teacher_start_longitude double precision,
  add column if not exists teacher_start_location_name text;

alter table public.class_attendance_records
  add column if not exists location_verified boolean;

notify pgrst, 'reload schema';
