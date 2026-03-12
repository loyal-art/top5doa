-- Topic suggestions table — premium users can suggest new debate topics
create table if not exists public.topic_suggestions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  description text not null,
  categories  text[] not null default '{}',
  status      text not null default 'pending',
  vote_count  int not null default 0,
  created_at  timestamptz not null default now()
);

-- RLS
alter table public.topic_suggestions enable row level security;

-- Authenticated users can read all suggestions
create policy "Anyone authenticated can read suggestions"
  on public.topic_suggestions for select
  to authenticated
  using (true);

-- Authenticated users can insert their own suggestions
create policy "Users can insert own suggestions"
  on public.topic_suggestions for insert
  to authenticated
  with check (auth.uid() = user_id);
