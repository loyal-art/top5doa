-- Hot Takes system: tables, constraints, and RLS policies

-- hot_takes table
create table hot_takes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles (id),
  topic_id    uuid not null references topics (id),
  subject_id  uuid references subjects (id),
  attribute_id uuid references attributes (id),
  content     text not null check (char_length(content) <= 280),
  flames      int not null default 0,
  trashes     int not null default 0,
  created_at  timestamptz not null default now()
);

-- One take per subject per topic per user
create unique index hot_takes_user_subject on hot_takes (user_id, topic_id, subject_id)
  where subject_id is not null;

-- One take per attribute per topic per user
create unique index hot_takes_user_attribute on hot_takes (user_id, topic_id, attribute_id)
  where attribute_id is not null;

-- hot_take_votes table
create table hot_take_votes (
  id           uuid primary key default gen_random_uuid(),
  hot_take_id  uuid not null references hot_takes (id) on delete cascade,
  user_id      uuid not null references profiles (id),
  vote_type    text not null check (vote_type in ('flame', 'trash')),
  created_at   timestamptz not null default now(),
  unique (hot_take_id, user_id)
);

-- Indexes for common queries
create index hot_takes_topic_id on hot_takes (topic_id);
create index hot_takes_user_id on hot_takes (user_id);
create index hot_takes_created_at on hot_takes (created_at desc);
create index hot_take_votes_hot_take_id on hot_take_votes (hot_take_id);
create index hot_take_votes_user_id on hot_take_votes (user_id);

-- RLS for hot_takes
alter table hot_takes enable row level security;

create policy "Anyone can read hot takes"
  on hot_takes for select
  using (true);

create policy "Authenticated users can insert their own hot takes"
  on hot_takes for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own hot takes"
  on hot_takes for delete
  using (auth.uid() = user_id);

-- RLS for hot_take_votes
alter table hot_take_votes enable row level security;

create policy "Anyone can read hot take votes"
  on hot_take_votes for select
  using (true);

create policy "Authenticated users can insert their own votes"
  on hot_take_votes for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own votes"
  on hot_take_votes for delete
  using (auth.uid() = user_id);
