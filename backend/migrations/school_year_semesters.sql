-- School year → 2 semesters → Midterm + Finals — run in Supabase SQL Editor.
--
-- The backend now picks the current grading period from today's date, and a
-- student's enrollment lasts the whole semester (Midterm + Finals).
--
-- The DATES below are placeholders until the school confirms its calendar.
-- To change them later, edit start_date / end_date of these 4 rows
-- (Table Editor → grading_periods). Keep the periods back to back, no gaps.

alter table public.grading_periods
  add column if not exists semester smallint,
  add column if not exists term text;

alter table public.grading_periods
  drop constraint if exists grading_periods_semester_check;
alter table public.grading_periods
  add constraint grading_periods_semester_check
  check (semester is null or semester in (1, 2));

alter table public.grading_periods
  drop constraint if exists grading_periods_term_check;
alter table public.grading_periods
  add constraint grading_periods_term_check
  check (term is null or term in ('midterm', 'finals'));

-- The old "Q2" row becomes 1st Sem Midterm, so every existing enrollment,
-- grade and gradecard (they point at this row) stays in S.Y. 2026-2027.
update public.grading_periods
set name = '1st Sem – Midterm',
    school_year = '2026-2027',
    semester = 1,
    term = 'midterm',
    start_date = '2026-06-08',
    end_date = '2026-08-21'
where id = '82c5d573-bd85-4135-9a59-8784ebe10c3b';

insert into public.grading_periods (id, name, school_year, semester, term, start_date, end_date, is_current)
select gen_random_uuid(), v.name, '2026-2027', v.semester, v.term, v.start_date::date, v.end_date::date, false
from (values
  ('1st Sem – Finals',  1, 'finals',  '2026-08-22', '2026-10-31'),
  ('2nd Sem – Midterm', 2, 'midterm', '2026-11-01', '2027-01-23'),
  ('2nd Sem – Finals',  2, 'finals',  '2027-01-24', '2027-04-08')
) as v(name, semester, term, start_date, end_date)
where not exists (
  select 1 from public.grading_periods g
  where g.school_year = '2026-2027' and g.semester = v.semester and g.term = v.term
);

create unique index if not exists grading_periods_sy_semester_term_key
  on public.grading_periods (school_year, semester, term);

-- The new backend picks the current period from the date; is_current is only
-- a last resort there. It stays on the old row on purpose: a server still
-- running the old code keeps using that row, so nobody loses their subjects
-- whether this SQL or the code update goes live first.

notify pgrst, 'reload schema';

-- Check: should list 4 rows for 2026-2027.
select name, school_year, semester, term, start_date, end_date
from public.grading_periods
order by start_date;
