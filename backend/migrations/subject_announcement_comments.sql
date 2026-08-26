-- Class Stream: comments + a single "like" reaction on subject_announcements
-- posts, so it feels like Google Classroom's Stream. See main.py
-- POST /subjects/{subject_id}/announcements/{announcement_id}/comments
-- and  POST /subjects/{subject_id}/announcements/{announcement_id}/react
-- Run once in Supabase SQL editor (after subject_announcements.sql).

create table if not exists public.subject_announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.subject_announcements(id) on delete cascade,
  author_id_number text not null,
  author_role text not null check (author_role in ('teacher', 'student')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists subject_announcement_comments_announcement_id_idx
  on public.subject_announcement_comments (announcement_id, created_at asc);

-- One reaction ("like") per person per announcement; POST toggles it.
create table if not exists public.subject_announcement_reactions (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.subject_announcements(id) on delete cascade,
  reactor_id_number text not null,
  created_at timestamptz not null default now(),
  unique (announcement_id, reactor_id_number)
);

create index if not exists subject_announcement_reactions_announcement_id_idx
  on public.subject_announcement_reactions (announcement_id);
