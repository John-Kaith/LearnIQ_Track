-- School Year page: remember whether the admin has checked a school year's
-- dates — run in Supabase SQL Editor.
--
-- Next year's periods are created automatically (dates copied from this
-- year); they start unchecked, and the admin dashboard asks the admin to
-- review them on the School Year page. Saving there marks them checked.

alter table public.grading_periods
  add column if not exists dates_confirmed boolean not null default true;

-- The 2026-2027 dates were placeholders, so ask the admin to check them.
update public.grading_periods
set dates_confirmed = false
where school_year = '2026-2027';

notify pgrst, 'reload schema';

-- Check: 4 rows for 2026-2027 with dates_confirmed = false.
select name, school_year, start_date, end_date, dates_confirmed
from public.grading_periods
order by start_date;
