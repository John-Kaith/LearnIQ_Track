-- AI-generated vocabulary word list used by the Battle Arena word-attack game.
-- Run once in Supabase SQL Editor.

alter table if exists public.lesson_content
  add column if not exists battle_words jsonb;
