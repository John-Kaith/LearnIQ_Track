-- Arcade games after Word Clash (Tic-Tac-Know and every future game) save their
-- results as event_type 'game', with metadata.game naming the game.
-- Run once in the Supabase SQL editor. Future games need no further change.

alter table if exists public.student_learning_events
  drop constraint if exists student_learning_events_event_type_check;

alter table if exists public.student_learning_events
  add constraint student_learning_events_event_type_check
  check (event_type in ('reviewer', 'activity', 'battle', 'game'));
