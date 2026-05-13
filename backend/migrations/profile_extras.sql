-- =====================================================================
-- LearnIQ Track: add editable profile fields (bio, phone, section, dob,
-- address) and the avatar photo to the existing `profiles` table.
--
-- Run once in the Supabase SQL Editor. Safe to re-run; uses IF NOT EXISTS.
-- =====================================================================

alter table if exists public.profiles
  add column if not exists bio text,
  add column if not exists phone text,
  add column if not exists section text,
  add column if not exists dob date,
  add column if not exists address text,
  add column if not exists avatar_data text;

-- Optional: ensure long base64 avatar strings are allowed by API.
-- (Supabase's default `text` column has no length limit, so nothing else
-- needs to change.)
