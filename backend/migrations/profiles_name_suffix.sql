-- Name suffix (Jr., Sr., III, IV, V) on signup.
alter table if exists public.profiles
  add column if not exists name_suffix text;

NOTIFY pgrst, 'reload schema';
