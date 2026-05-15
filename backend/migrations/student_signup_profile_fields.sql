-- Student signup: separate name fields + SHS year level / strand on profiles.
-- Safe to re-run. Your ERD may already have grade_level and strand; IF NOT EXISTS skips duplicates.

alter table if exists public.profiles
  add column if not exists last_name text,
  add column if not exists first_name text,
  add column if not exists middle_name text,
  add column if not exists name_suffix text,
  add column if not exists grade_level text,
  add column if not exists strand text;

-- Then run profiles_drop_full_name_column.sql to remove full_name.

NOTIFY pgrst, 'reload schema';
