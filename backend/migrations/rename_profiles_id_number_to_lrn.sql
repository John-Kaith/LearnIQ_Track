-- Rename profiles.id_number → lrn (Learner Reference Number / school ID).
-- Deploy updated app code first, then run in Supabase SQL Editor.

ALTER TABLE public.profiles
  RENAME COLUMN id_number TO lrn;

COMMENT ON COLUMN public.profiles.lrn IS 'Learner Reference Number (LRN) — also used for teacher/admin employee IDs';

-- Recreate leaderboard view if it still references id_number
DROP VIEW IF EXISTS public.leaderboard;

CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  p.id AS student_id,
  p.lrn,
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
  ) AS display_name,
  coalesce(sum(coalesce(qa.score, 0)), 0)::bigint AS total_points,
  count(qa.id)::bigint AS quiz_attempts,
  CASE
    WHEN coalesce(sum(coalesce(qa.total_questions, 0)), 0) > 0 THEN
      round(
        100.0 * sum(coalesce(qa.score, 0))::numeric
        / nullif(sum(coalesce(qa.total_questions, 0)), 0)::numeric,
        1
      )
    ELSE 0::numeric
  END AS progress_pct,
  max(qa.submitted_at) AS last_activity
FROM public.profiles p
LEFT JOIN public.quiz_attempts qa ON qa.student_id = p.id
WHERE lower(coalesce(p.role, '')) = 'student'
GROUP BY
  p.id,
  p.lrn,
  p.first_name,
  p.middle_name,
  p.last_name,
  p.name_suffix
HAVING count(qa.id) > 0;

NOTIFY pgrst, 'reload schema';
