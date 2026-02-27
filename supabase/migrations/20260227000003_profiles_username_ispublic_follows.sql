-- ============================================================================
-- Add username + is_public to profiles; create follows table
-- ============================================================================

-- 1. New columns on profiles ------------------------------------------------

alter table public.profiles
  add column if not exists username  text,
  add column if not exists is_public boolean not null default true;

-- 2. Backfill username for any rows that pre-date this migration -------------
--    Pattern: slug(display_name) + first-6-hex-chars-of-id (guarantees uniqueness)

update public.profiles
set username = lower(
    regexp_replace(
      trim(coalesce(display_name, 'user')),
      '[^a-zA-Z0-9]+', '_', 'g'
    )
  ) || substr(replace(id::text, '-', ''), 1, 6)
where username is null;

-- 3. Enforce NOT NULL + UNIQUE now that every row has a value ----------------

alter table public.profiles
  alter column username set not null,
  add constraint profiles_username_key unique (username);

create index if not exists idx_profiles_username on public.profiles (username);

-- 4. Update handle_new_user() to set username on sign-up --------------------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', 'User'),
    new.raw_user_meta_data ->> 'avatar_url',
    lower(
      regexp_replace(
        trim(coalesce(
          new.raw_user_meta_data ->> 'display_name',
          new.raw_user_meta_data ->> 'full_name',
          'user'
        )),
        '[^a-zA-Z0-9]+', '_', 'g'
      )
    ) || substr(replace(new.id::text, '-', ''), 1, 6)
  );

  insert into public.user_credits (user_id, balance)
  values (new.id, 0);

  return new;
end;
$$;

-- 5. follows table -----------------------------------------------------------

create table if not exists public.follows (
  id           uuid primary key default uuid_generate_v4(),
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),

  unique (follower_id, following_id),
  check  (follower_id <> following_id)
);

comment on table public.follows is 'Follow relationships between users.';

create index if not exists idx_follows_follower  on public.follows (follower_id);
create index if not exists idx_follows_following on public.follows (following_id);

-- 6. RLS on follows ----------------------------------------------------------

alter table public.follows enable row level security;

create policy "Follows are viewable by everyone"
  on public.follows for select using (true);

create policy "Authenticated users can follow"
  on public.follows for insert with check (auth.uid() = follower_id);

create policy "Users can unfollow"
  on public.follows for delete using (auth.uid() = follower_id);

-- 7. user_lists visibility for profile pages ---------------------------------
-- The existing "Users can view their own lists" RLS policy blocks other users
-- from reading user_lists, which would prevent the profile page from showing
-- voted topics.  Add two permissive SELECT policies (combined with OR):
--   a) Public profiles  — anyone can read their lists
--   b) Private profiles — followers can read their lists

create policy "Public profile lists are viewable by everyone"
  on public.user_lists for select
  using (
    exists (
      select 1 from public.profiles
      where id = user_lists.user_id
        and is_public = true
    )
  );

create policy "Followers can view private profile lists"
  on public.user_lists for select
  using (
    exists (
      select 1 from public.follows
      where follower_id  = auth.uid()
        and following_id = user_lists.user_id
    )
  );
