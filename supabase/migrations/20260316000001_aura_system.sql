-- ============================================================================
-- TOP5DOA — Aura System
-- Adds 17-tier aura ladder, aura_log, and RPC for awarding aura points.
-- ============================================================================

-- ── 1. PROFILES: add new columns ─────────────────────────────────────────────

-- Change tier from enum to text (17 aura tiers replace free/premium enum)
alter table profiles alter column tier drop default;
alter table profiles alter column tier type text using (
  case tier::text
    when 'free'    then 'Ghost'
    when 'premium' then 'Ghost'
    else 'Ghost'
  end
);
alter table profiles alter column tier set default 'Ghost';

-- Streak tracking
alter table profiles add column if not exists daily_streak      integer     not null default 0;
alter table profiles add column if not exists last_active_date  date;
alter table profiles add column if not exists streak_multiplier numeric(6,2) not null default 1.0;

-- ── 2. AURA_LOG ──────────────────────────────────────────────────────────────

create table if not exists aura_log (
  id           uuid        primary key default uuid_generate_v4(),
  user_id      uuid        not null references profiles (id) on delete cascade,
  action       text        not null,  -- vote | share | receive_follow | follow | flame | suggest_topic | suggestion_vote
  points       integer     not null,
  reference_id uuid,                  -- topic_id / hot_take_id / suggestion_id / user_id
  created_at   timestamptz not null default now()
);

comment on table aura_log is 'Ledger of all Aura point events. Prevents duplicate awards per (user, action, reference_id).';

create index if not exists idx_aura_log_user_id    on aura_log (user_id);
create index if not exists idx_aura_log_action     on aura_log (action);
create index if not exists idx_aura_log_created_at on aura_log (created_at);

-- RLS
alter table aura_log enable row level security;

create policy "Users can read own aura log"
  on aura_log for select
  using (auth.uid() = user_id);

-- ── 3. UPDATE get_aura_tier() to 17 tiers ────────────────────────────────────

create or replace function get_aura_tier(points integer)
returns text
language sql
immutable
as $$
  select case
    when points >= 50000 then 'Aura Beast'
    when points >= 40000 then 'Mythic'
    when points >= 30000 then 'Immortal'
    when points >= 20000 then 'GOAT'
    when points >= 13000 then 'Hall of Fame'
    when points >= 9000  then 'Legendary'
    when points >= 7500  then 'Superstar'
    when points >= 6000  then 'Icon'
    when points >= 4000  then 'Power Player'
    when points >= 2500  then 'Influencer'
    when points >= 1500  then 'Elite'
    when points >= 1000  then 'Respected'
    when points >= 750   then 'Recognized'
    when points >= 350   then 'Known'
    when points >= 150   then 'Warming Up'
    when points >= 50    then 'Cold'
    else                      'Ghost'
  end;
$$;

-- ── 4. award_aura() RPC — atomic duplicate-check + insert + update ────────────

create or replace function award_aura(
  p_user_id     uuid,
  p_action      text,
  p_points      integer,
  p_reference_id uuid default null
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_exists      boolean := false;
  v_new_points  integer;
  v_day_count   integer;
begin
  -- Duplicate-guard: same user + action + reference_id combination
  if p_reference_id is not null then
    select exists(
      select 1 from aura_log
      where user_id     = p_user_id
        and action      = p_action
        and reference_id = p_reference_id
    ) into v_exists;
  else
    select exists(
      select 1 from aura_log
      where user_id = p_user_id
        and action  = p_action
        and reference_id is null
    ) into v_exists;
  end if;

  if v_exists then
    return false;
  end if;

  -- Daily cap for suggest_topic (max 5 per day)
  if p_action = 'suggest_topic' then
    select count(*) into v_day_count
    from aura_log
    where user_id    = p_user_id
      and action     = 'suggest_topic'
      and created_at >= date_trunc('day', now());

    if v_day_count >= 5 then
      return false;
    end if;
  end if;

  -- Insert log entry
  insert into aura_log (user_id, action, points, reference_id)
  values (p_user_id, p_action, p_points, p_reference_id);

  -- Increment aura_points and recalculate tier
  update profiles
  set aura_points = aura_points + p_points,
      tier        = get_aura_tier(aura_points + p_points),
      updated_at  = now()
  where id = p_user_id
  returning aura_points into v_new_points;

  return true;
end;
$$;

-- Grant execute to authenticated users (the function is security definer so
-- it runs with elevated privileges for the DB writes, but callers must be
-- authenticated — the auth.uid() check lives in the application layer).
grant execute on function award_aura(uuid, text, integer, uuid) to authenticated;
