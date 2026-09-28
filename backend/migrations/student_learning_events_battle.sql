-- Allow AI Battle Arena results in student_learning_events.
-- Battle history (points, EXP, level) is stored here; arena level / EXP / best
-- score are computed from these rows (see get_student_battle_stats in db_supabase.py).
-- The original constraint only allowed 'reviewer' and 'activity', so battle rows were rejected.

alter table if exists public.student_learning_events
  drop constraint if exists student_learning_events_event_type_check;

alter table if exists public.student_learning_events
  add constraint student_learning_events_event_type_check
  check (event_type in ('reviewer', 'activity', 'battle'));
-- .
