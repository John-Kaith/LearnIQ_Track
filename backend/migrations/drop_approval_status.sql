-- Remove account approval workflow (accounts are active on registration).
-- Run in Supabase SQL Editor after deploying app code without approval_status.

ALTER TABLE IF EXISTS public.profiles
  DROP COLUMN IF EXISTS approval_status;
