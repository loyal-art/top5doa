-- ============================================================================
-- TOP5DOA — Initial Database Schema
-- ============================================================================
-- Tech: Supabase (PostgreSQL), Next.js, Vercel
-- Auth: Supabase Auth (Email, Google, Facebook)
-- Payments: Stripe (credit bundles)
-- ============================================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

create type user_tier as enum ('free', 'premium');

create type topic_status as enum ('draft', 'pending', 'active', 'archived');

create type attribute_status as enum ('active', 'suggested', 'voting', 'approved', 'rejected');

create type vote_type as enum ('cosign', 'nah');

create type aura_source_type as enum (
  'list_cosign',
  'list_nah',
  'topic_voters',
  'attribute_approved',
  'attribute_ranked',
  'comment_cosign',
  'comment_nah'
);

create type credit_transaction_type as enum ('purchase', 'spend');

create type unlock_type as enum ('result_position', 'additional_subject');

-- ============================================================================
-- PROFILES
-- Extends Supabase auth.users with app-specific data
-- ============================================================================

create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url  text,
  tier        user_tier not null default 'free',
  aura_points integer not null default 0,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table profiles is 'User profiles extending Supabase auth. Stores tier, aura, and display info.';

-- ============================================================================
-- TOPICS
-- A debate category (e.g., "Greatest NBA Player of All Time")
-- ============================================================================

create table topics (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  slug        text not null unique,
  category    text not null,
  description text,
  cover_image_url text,
  status      topic_status not null default 'pending',
  creator_id  uuid not null references profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table topics is 'Debate topics. Premium users can submit; admins approve.';

create index idx_topics_status on topics (status);
create index idx_topics_category on topics (category);
create index idx_topics_creator on topics (creator_id);

-- ============================================================================
-- SUBJECTS
-- The entities being ranked within a topic (e.g., "LeBron James")
-- ============================================================================

create table subjects (
  id          uuid primary key default uuid_generate_v4(),
  topic_id    uuid not null references topics (id) on delete cascade,
  name        text not null,
  era         text,
  stats       jsonb,
  photo_url   text,
  created_at  timestamptz not null default now(),

  unique (topic_id, name)
);

comment on table subjects is 'Subjects being ranked within a topic.';

create index idx_subjects_topic on subjects (topic_id);

-- ============================================================================
-- ATTRIBUTES
-- Scoring criteria for a topic (e.g., "Scoring Ability", "Defense")
-- ============================================================================

create table attributes (
  id            uuid primary key default uuid_generate_v4(),
  topic_id      uuid not null references topics (id) on delete cascade,
  name          text not null,
  description   text,
  status        attribute_status not null default 'active',
  suggested_by  uuid references profiles (id) on delete set null,
  approved_at   timestamptz,
  created_at    timestamptz not null default now(),

  unique (topic_id, name)
);

comment on table attributes is 'Scoring criteria per topic. Admins create initial set; premium users suggest additions.';

create index idx_attributes_topic on attributes (topic_id);
create index idx_attributes_status on attributes (topic_id, status);

-- ============================================================================
-- USER ATTRIBUTE RANKS
-- How a user ranks attribute importance within a topic (1st, 2nd, 3rd...)
-- Rank position converts to weighted points that sum to 100
-- ============================================================================

create table user_attribute_ranks (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references profiles (id) on delete cascade,
  topic_id        uuid not null references topics (id) on delete cascade,
  attribute_id    uuid not null references attributes (id) on delete cascade,
  rank_position   integer not null check (rank_position >= 1),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (user_id, topic_id, attribute_id),
  unique (user_id, topic_id, rank_position)
);

comment on table user_attribute_ranks is 'Each user ranks attributes by importance per topic. No sliders — ordinal rank only.';

create index idx_user_attr_ranks_user_topic on user_attribute_ranks (user_id, topic_id);

-- ============================================================================
-- USER SUBJECT SCORES
-- A user's 1–10 rating of a subject on a specific attribute
-- ============================================================================

create table user_subject_scores (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references profiles (id) on delete cascade,
  topic_id      uuid not null references topics (id) on delete cascade,
  subject_id    uuid not null references subjects (id) on delete cascade,
  attribute_id  uuid not null references attributes (id) on delete cascade,
  score         integer not null check (score >= 1 and score <= 10),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (user_id, subject_id, attribute_id)
);

comment on table user_subject_scores is 'Raw per-attribute scores (1–10) that each user gives to each subject.';

create index idx_user_scores_user_topic on user_subject_scores (user_id, topic_id);
create index idx_user_scores_subject on user_subject_scores (subject_id);
create index idx_user_scores_topic_attr on user_subject_scores (topic_id, attribute_id);

-- ============================================================================
-- USER LISTS
-- Cached personal ranked results per user per topic
-- Recalculated whenever attribute ranks or subject scores change
-- ============================================================================

create table user_lists (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references profiles (id) on delete cascade,
  topic_id          uuid not null references topics (id) on delete cascade,
  subject_id        uuid not null references subjects (id) on delete cascade,
  calculated_score  numeric(8, 4) not null,
  rank_position     integer not null check (rank_position >= 1),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (user_id, topic_id, subject_id),
  unique (user_id, topic_id, rank_position)
);

comment on table user_lists is 'Cached personal ranked list. Global list is never stored — always computed on the fly from premium user data.';

create index idx_user_lists_user_topic on user_lists (user_id, topic_id);
create index idx_user_lists_topic_rank on user_lists (topic_id, rank_position);

-- ============================================================================
-- ATTRIBUTE SUGGESTION VOTES
-- Community cosign/nah on suggested attributes
-- Vote count acts as priority queue for admin review
-- ============================================================================

create table attribute_suggestion_votes (
  id            uuid primary key default uuid_generate_v4(),
  attribute_id  uuid not null references attributes (id) on delete cascade,
  user_id       uuid not null references profiles (id) on delete cascade,
  vote_type     vote_type not null,
  created_at    timestamptz not null default now(),

  unique (attribute_id, user_id)
);

comment on table attribute_suggestion_votes is 'Community votes on suggested attributes. Cosign/nah drives priority queue for admin approval.';

create index idx_attr_votes_attribute on attribute_suggestion_votes (attribute_id);

-- ============================================================================
-- COMMENTS
-- User comments on topics (supports threading via parent_id)
-- ============================================================================

create table comments (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles (id) on delete cascade,
  topic_id    uuid not null references topics (id) on delete cascade,
  parent_id   uuid references comments (id) on delete cascade,
  body        text not null check (char_length(body) > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table comments is 'Threaded comments on topics.';

create index idx_comments_topic on comments (topic_id, created_at);
create index idx_comments_parent on comments (parent_id);
create index idx_comments_user on comments (user_id);

-- ============================================================================
-- COSIGNS
-- Cosign / Nah on user lists and comments
-- Cosigns add Aura, Nahs subtract Aura
-- ============================================================================

create table cosigns (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles (id) on delete cascade,
  target_type text not null check (target_type in ('list', 'comment')),
  target_id   uuid not null,
  vote_type   vote_type not null,
  created_at  timestamptz not null default now(),

  unique (user_id, target_type, target_id)
);

comment on table cosigns is 'Cosign/Nah reactions on lists and comments. Drives Aura calculations.';

create index idx_cosigns_target on cosigns (target_type, target_id);
create index idx_cosigns_user on cosigns (user_id);

-- ============================================================================
-- AURA TRANSACTIONS
-- Aura point ledger — all earned and deducted aura tracked here
-- Timestamps used for diminishing returns calculation
-- ============================================================================

create table aura_transactions (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references profiles (id) on delete cascade,
  source_type   aura_source_type not null,
  source_id     uuid not null,
  points        integer not null,
  created_at    timestamptz not null default now()
);

comment on table aura_transactions is
  'Aura ledger. Points can be positive or negative. '
  'Diminishing returns: full value <90 days, half 90d–1yr, trickle >1yr. '
  'Single attribute capped at 500 total aura.';

create index idx_aura_tx_user on aura_transactions (user_id, created_at);
create index idx_aura_tx_source on aura_transactions (source_type, source_id);

-- ============================================================================
-- CREDIT BUNDLES
-- Stripe product catalog for purchasable credit bundles
-- ============================================================================

create table credit_bundles (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  credit_amount   integer not null check (credit_amount > 0),
  price_cents     integer not null check (price_cents > 0),
  stripe_price_id text not null unique,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

comment on table credit_bundles is 'Purchasable credit bundles. ~$0.30 effective cost per credit.';

-- ============================================================================
-- USER CREDITS
-- Current credit balance per user
-- ============================================================================

create table user_credits (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references profiles (id) on delete cascade unique,
  balance     integer not null default 0 check (balance >= 0),
  updated_at  timestamptz not null default now()
);

comment on table user_credits is 'Current credit balance. One row per user.';

-- ============================================================================
-- CREDIT TRANSACTIONS
-- Purchase and spend history for credits
-- ============================================================================

create table credit_transactions (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references profiles (id) on delete cascade,
  amount            integer not null,
  type              credit_transaction_type not null,
  stripe_payment_id text,
  description       text,
  created_at        timestamptz not null default now()
);

comment on table credit_transactions is 'Credit ledger. Positive = purchase, negative = spend.';

create index idx_credit_tx_user on credit_transactions (user_id, created_at);

-- ============================================================================
-- USER TOPIC UNLOCKS
-- Tracks per-user unlocks: extra result positions (free tier) or extra subjects
-- ============================================================================

create table user_topic_unlocks (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references profiles (id) on delete cascade,
  topic_id      uuid not null references topics (id) on delete cascade,
  unlock_type   unlock_type not null,
  reference_id  uuid,
  created_at    timestamptz not null default now(),

  unique (user_id, topic_id, unlock_type, reference_id)
);

comment on table user_topic_unlocks is
  'Tracks credit-purchased unlocks: additional result positions (free users) and extra subjects (both tiers).';

create index idx_unlocks_user_topic on user_topic_unlocks (user_id, topic_id);

-- ============================================================================
-- SCORING CONFIGS
-- Weight distributions per attribute count — configuration-based, not hardcoded
-- Adjustable without breaking historical data (raw inputs stored separately)
-- ============================================================================

create table scoring_configs (
  id              uuid primary key default uuid_generate_v4(),
  attribute_count integer not null unique check (attribute_count >= 2 and attribute_count <= 10),
  weights         jsonb not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

comment on table scoring_configs is
  'Weight distribution per attribute count. Weights array must sum to 100. '
  'e.g., 4 attributes → [40, 30, 20, 10]. Decoupled from raw user inputs.';

-- Seed default weight configs (always sum to 100)
insert into scoring_configs (attribute_count, weights) values
  (2,  '[60, 40]'),
  (3,  '[45, 33, 22]'),
  (4,  '[40, 30, 20, 10]'),
  (5,  '[30, 25, 20, 15, 10]'),
  (6,  '[27, 22, 18, 15, 11, 7]'),
  (7,  '[24, 20, 16, 14, 11, 9, 6]'),
  (8,  '[22, 18, 15, 13, 11, 9, 7, 5]'),
  (9,  '[20, 17, 14, 12, 11, 9, 7, 6, 4]'),
  (10, '[19, 16, 13, 11, 10, 9, 7, 6, 5, 4]');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Auto-create a profile row when a new user signs up via Supabase Auth
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', 'User'),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  insert into public.user_credits (user_id, balance)
  values (new.id, 0);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Auto-update updated_at on row changes
create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on profiles
  for each row execute function update_updated_at();

create trigger set_updated_at before update on topics
  for each row execute function update_updated_at();

create trigger set_updated_at before update on user_attribute_ranks
  for each row execute function update_updated_at();

create trigger set_updated_at before update on user_subject_scores
  for each row execute function update_updated_at();

create trigger set_updated_at before update on user_lists
  for each row execute function update_updated_at();

create trigger set_updated_at before update on comments
  for each row execute function update_updated_at();

create trigger set_updated_at before update on user_credits
  for each row execute function update_updated_at();

-- Compute aura tier label from points
create or replace function get_aura_tier(points integer)
returns text
language plpgsql
immutable
as $$
begin
  return case
    when points >= 9500 then 'Legendary'
    when points >= 5000 then 'Elite'
    when points >= 2500 then 'Respected'
    when points >= 1000 then 'Known'
    when points >= 250  then 'Cold'
    else 'Ghost'
  end;
end;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table profiles enable row level security;
alter table topics enable row level security;
alter table subjects enable row level security;
alter table attributes enable row level security;
alter table user_attribute_ranks enable row level security;
alter table user_subject_scores enable row level security;
alter table user_lists enable row level security;
alter table attribute_suggestion_votes enable row level security;
alter table comments enable row level security;
alter table cosigns enable row level security;
alter table aura_transactions enable row level security;
alter table credit_bundles enable row level security;
alter table user_credits enable row level security;
alter table credit_transactions enable row level security;
alter table user_topic_unlocks enable row level security;
alter table scoring_configs enable row level security;

-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------
create policy "Profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- TOPICS
-- ---------------------------------------------------------------------------
create policy "Active topics are viewable by everyone"
  on topics for select using (status = 'active');

create policy "Admins can view all topics"
  on topics for select using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

create policy "Premium users can submit topics"
  on topics for insert with check (
    auth.uid() = creator_id
    and exists (select 1 from profiles where id = auth.uid() and tier = 'premium')
  );

create policy "Admins can update topics"
  on topics for update using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- ---------------------------------------------------------------------------
-- SUBJECTS
-- ---------------------------------------------------------------------------
create policy "Subjects are viewable when topic is active"
  on subjects for select using (
    exists (select 1 from topics where id = topic_id and status = 'active')
  );

create policy "Admins can manage subjects"
  on subjects for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- ---------------------------------------------------------------------------
-- ATTRIBUTES
-- ---------------------------------------------------------------------------
create policy "Active attributes are viewable on active topics"
  on attributes for select using (
    status in ('active', 'approved')
    and exists (select 1 from topics where id = topic_id and status = 'active')
  );

create policy "Suggested attributes viewable on active topics"
  on attributes for select using (
    status in ('suggested', 'voting')
    and exists (select 1 from topics where id = topic_id and status = 'active')
  );

create policy "Premium users can suggest attributes"
  on attributes for insert with check (
    auth.uid() = suggested_by
    and status = 'suggested'
    and exists (select 1 from profiles where id = auth.uid() and tier = 'premium')
  );

create policy "Admins can manage attributes"
  on attributes for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- ---------------------------------------------------------------------------
-- USER ATTRIBUTE RANKS
-- ---------------------------------------------------------------------------
create policy "Users can view their own attribute ranks"
  on user_attribute_ranks for select using (auth.uid() = user_id);

create policy "Users can insert their own attribute ranks"
  on user_attribute_ranks for insert with check (auth.uid() = user_id);

create policy "Users can update their own attribute ranks"
  on user_attribute_ranks for update using (auth.uid() = user_id);

create policy "Users can delete their own attribute ranks"
  on user_attribute_ranks for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- USER SUBJECT SCORES
-- ---------------------------------------------------------------------------
create policy "Users can view their own scores"
  on user_subject_scores for select using (auth.uid() = user_id);

create policy "Users can insert their own scores"
  on user_subject_scores for insert with check (auth.uid() = user_id);

create policy "Users can update their own scores"
  on user_subject_scores for update using (auth.uid() = user_id);

create policy "Users can delete their own scores"
  on user_subject_scores for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- USER LISTS
-- ---------------------------------------------------------------------------
create policy "Users can view their own lists"
  on user_lists for select using (auth.uid() = user_id);

create policy "System can manage user lists"
  on user_lists for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- Allow the authenticated user to manage their own cached list
create policy "Users can manage their own list cache"
  on user_lists for all using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- ATTRIBUTE SUGGESTION VOTES
-- ---------------------------------------------------------------------------
create policy "Votes are viewable by everyone"
  on attribute_suggestion_votes for select using (true);

create policy "Authenticated users can vote"
  on attribute_suggestion_votes for insert with check (auth.uid() = user_id);

create policy "Users can change their vote"
  on attribute_suggestion_votes for update using (auth.uid() = user_id);

create policy "Users can remove their vote"
  on attribute_suggestion_votes for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- COMMENTS
-- ---------------------------------------------------------------------------
create policy "Comments are viewable on active topics"
  on comments for select using (
    exists (select 1 from topics where id = topic_id and status = 'active')
  );

create policy "Authenticated users can comment"
  on comments for insert with check (auth.uid() = user_id);

create policy "Users can update their own comments"
  on comments for update using (auth.uid() = user_id);

create policy "Users can delete their own comments"
  on comments for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- COSIGNS
-- ---------------------------------------------------------------------------
create policy "Cosigns are viewable by everyone"
  on cosigns for select using (true);

create policy "Authenticated users can cosign"
  on cosigns for insert with check (auth.uid() = user_id);

create policy "Users can change their cosign"
  on cosigns for update using (auth.uid() = user_id);

create policy "Users can remove their cosign"
  on cosigns for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- AURA TRANSACTIONS
-- ---------------------------------------------------------------------------
create policy "Users can view their own aura history"
  on aura_transactions for select using (auth.uid() = user_id);

-- Inserts handled by server-side functions (service role), not direct client access

-- ---------------------------------------------------------------------------
-- CREDIT BUNDLES
-- ---------------------------------------------------------------------------
create policy "Credit bundles are viewable by everyone"
  on credit_bundles for select using (active = true);

create policy "Admins can manage credit bundles"
  on credit_bundles for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- ---------------------------------------------------------------------------
-- USER CREDITS
-- ---------------------------------------------------------------------------
create policy "Users can view their own credit balance"
  on user_credits for select using (auth.uid() = user_id);

-- Balance mutations handled by server-side functions (service role)

-- ---------------------------------------------------------------------------
-- CREDIT TRANSACTIONS
-- ---------------------------------------------------------------------------
create policy "Users can view their own credit transactions"
  on credit_transactions for select using (auth.uid() = user_id);

-- Inserts handled by server-side functions (service role)

-- ---------------------------------------------------------------------------
-- USER TOPIC UNLOCKS
-- ---------------------------------------------------------------------------
create policy "Users can view their own unlocks"
  on user_topic_unlocks for select using (auth.uid() = user_id);

-- Inserts handled by server-side functions (service role)

-- ---------------------------------------------------------------------------
-- SCORING CONFIGS
-- ---------------------------------------------------------------------------
create policy "Scoring configs are viewable by everyone"
  on scoring_configs for select using (true);

create policy "Admins can manage scoring configs"
  on scoring_configs for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );
