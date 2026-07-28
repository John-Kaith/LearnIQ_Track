-- AI-generated question+answer pairs used by the Battle Arena quiz-battle game.
-- Replaces the earlier battle_words (open word list) approach.
-- Run once in Supabase SQL Editor.

alter table if exists public.lesson_content
  add column if not exists battle_questions jsonb;
