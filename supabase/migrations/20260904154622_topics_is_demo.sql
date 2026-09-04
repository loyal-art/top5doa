-- Demo topics: small admin-authored topics (2 subjects, 5 attributes) that
-- power the anonymous archetype quiz and the logged-out homepage entry point.
-- Nothing else changes: topics already carries a public SELECT policy, and
-- admin writes go through the existing update path.

alter table public.topics
  add column if not exists is_demo boolean not null default false;

comment on column public.topics.is_demo is
  'Admin-flagged demo topic used by the anonymous archetype quiz and homepage entry point.';

-- The homepage looks up active demo topics; keep that cheap.
create index if not exists topics_is_demo_active_idx
  on public.topics (is_demo)
  where is_demo = true and status = 'active';
