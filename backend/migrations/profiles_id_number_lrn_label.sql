-- profiles.lrn column (formerly id_number)
-- After rename, run: backend/migrations/rename_profiles_id_number_to_lrn.sql

COMMENT ON COLUMN public.profiles.lrn IS 'Learner Reference Number (LRN) — also teacher/admin employee ID';
