-- Topic suggestion votes — one vote per user per suggestion
create table if not exists public.topic_suggestion_votes (
  id            uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references public.topic_suggestions(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (suggestion_id, user_id)
);

-- RLS
alter table public.topic_suggestion_votes enable row level security;

-- Authenticated users can read all votes
create policy "Anyone authenticated can read votes"
  on public.topic_suggestion_votes for select
  to authenticated
  using (true);

-- Authenticated users can insert their own votes
create policy "Users can insert own votes"
  on public.topic_suggestion_votes for insert
  to authenticated
  with check (auth.uid() = user_id);
