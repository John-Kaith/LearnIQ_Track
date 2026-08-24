-- Fixed, admin-managed list of SHS sections (e.g. "STEM 12-A"), scoped to
-- grade level + strand. Registration picks from this list instead of free
-- text, and students can no longer self-edit their own section.
-- Run once in Supabase SQL editor.

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade_level text not null check (grade_level in ('11', '12')),
  strand text not null check (strand in ('STEM', 'ABM', 'HUMSS', 'TVL-HE')),
  created_at timestamptz not null default now()
);

create unique index if not exists sections_name_unique on public.sections (name);

create index if not exists sections_grade_strand_idx
  on public.sections (grade_level, strand);

comment on table public.sections is 'Admin-managed fixed list of SHS sections, scoped to grade level + strand.';
