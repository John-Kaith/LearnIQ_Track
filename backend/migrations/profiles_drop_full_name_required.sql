-- Signup no longer writes full_name; name is stored as last_name / first_name / middle_name.
alter table if exists public.profiles
  alter column full_name drop not null;

NOTIFY pgrst, 'reload schema';
