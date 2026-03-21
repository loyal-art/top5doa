-- Poster images: stores generated AI poster composites per user + topic
create table if not exists poster_images (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  topic_id    uuid not null references topics(id) on delete cascade,
  style       text not null,
  image_data  text not null,  -- base64-encoded PNG
  created_at  timestamptz not null default now()
);

-- Index for fast lookups: user's poster for a given topic
create index if not exists idx_poster_images_user_topic on poster_images(user_id, topic_id);

-- Index for listing all posters by a user (profile page)
create index if not exists idx_poster_images_user on poster_images(user_id, created_at desc);

-- RLS
alter table poster_images enable row level security;

-- Anyone can view posters (they're shareable)
create policy "poster_images_select" on poster_images
  for select using (true);

-- Users can insert their own posters
create policy "poster_images_insert" on poster_images
  for insert with check (auth.uid() = user_id);

-- Users can update (replace) their own posters
create policy "poster_images_update" on poster_images
  for update using (auth.uid() = user_id);

-- Users can delete their own posters
create policy "poster_images_delete" on poster_images
  for delete using (auth.uid() = user_id);
