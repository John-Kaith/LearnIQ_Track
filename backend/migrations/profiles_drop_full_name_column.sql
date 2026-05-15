-- Remove full_name from profiles (fixes: view leaderboard depends on full_name).

-- 1) Drop the old view that references full_name
drop view if exists public.leaderboard;

-- 2) Backfill name parts from full_name (skip if column already dropped)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name'
  ) then
    update public.profiles
    set
      first_name = coalesce(nullif(trim(first_name), ''), trim(full_name)),
      last_name = coalesce(nullif(trim(last_name), ''), '—')
    where coalesce(trim(full_name), '') <> ''
      and coalesce(trim(first_name), '') = ''
      and coalesce(trim(last_name), '') = '';
  end if;
end $$;

-- 3) Drop full_name column
alter table if exists public.profiles
  drop column if exists full_name;

-- 4) Recreate leaderboard view using name parts (optional; app also builds leaderboard in Python)
create or replace view public.leaderboard as
select
  p.id as student_id,
  p.id_number,
  trim(
    regexp_replace(
      concat_ws(
        ' ',
        nullif(trim(p.first_name), ''),
        nullif(trim(p.middle_name), ''),
        nullif(trim(p.last_name), ''),
        nullif(trim(p.name_suffix), '')
      ),
      '\s+',
      ' ',
      'g'
    )
  ) as display_name,
  coalesce(sum(coalesce(qa.score, 0)), 0)::bigint as total_points,
  count(qa.id)::bigint as quiz_attempts,
  case
    when coalesce(sum(coalesce(qa.total_questions, 0)), 0) > 0 then
      round(
        100.0 * sum(coalesce(qa.score, 0))::numeric
        / nullif(sum(coalesce(qa.total_questions, 0)), 0)::numeric,
        1
      )
    else 0::numeric
  end as progress_pct,
  max(qa.submitted_at) as last_activity
from public.profiles p
left join public.quiz_attempts qa on qa.student_id = p.id
where lower(coalesce(p.role, '')) = 'student'
group by
  p.id,
  p.id_number,
  p.first_name,
  p.middle_name,
  p.last_name,
  p.name_suffix
having count(qa.id) > 0;

NOTIFY pgrst, 'reload schema';
