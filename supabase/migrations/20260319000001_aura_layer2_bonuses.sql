-- ============================================================================
-- TOP5DOA — Aura Layer 2 Part 2: Viral Take Bonuses, Take of the Day, Hot Streak
-- ============================================================================

-- ── 1. New columns ────────────────────────────────────────────────────────────

-- take_of_the_day flag on hot_takes
alter table hot_takes
  add column if not exists take_of_the_day boolean not null default false;

-- hot_take_streak on profiles (consecutive hot takes with 10+ flames)
alter table profiles
  add column if not exists hot_take_streak integer not null default 0;

-- ── 2. check_viral_milestones() ───────────────────────────────────────────────
-- Called after a flame vote to award milestone bonuses to the take owner.
-- award_aura's duplicate guard (user_id, action, reference_id) ensures each
-- milestone is awarded at most once per take per user.

create or replace function check_viral_milestones(
  p_hot_take_id uuid,
  p_user_id     uuid,
  p_flame_count integer
)
returns void
language plpgsql
security definer
as $$
begin
  if p_flame_count >= 10 then
    perform award_aura(p_user_id, 'viral_take_10', 10, p_hot_take_id);
  end if;
  if p_flame_count >= 50 then
    perform award_aura(p_user_id, 'viral_take_50', 50, p_hot_take_id);
  end if;
  if p_flame_count >= 100 then
    perform award_aura(p_user_id, 'viral_take_100', 150, p_hot_take_id);
  end if;
end;
$$;

grant execute on function check_viral_milestones(uuid, uuid, integer) to authenticated;

-- ── 3. update_take_of_the_day() ───────────────────────────────────────────────
-- Finds today's most-flamed take (5+ flames, created today).
-- Updates take_of_the_day flag and, once per calendar day, awards +100 Aura
-- to the winning take's owner.

create or replace function update_take_of_the_day()
returns void
language plpgsql
security definer
as $$
declare
  v_take_id         uuid;
  v_user_id         uuid;
  v_already_awarded boolean := false;
begin
  -- Find today's top take (5+ flames, created today)
  select id, user_id
    into v_take_id, v_user_id
    from hot_takes
   where flames     >= 5
     and created_at >= date_trunc('day', now())
     and created_at <  date_trunc('day', now()) + interval '1 day'
   order by flames desc
   limit 1;

  -- Clear all existing TOTD flags (reset before re-marking winner)
  update hot_takes set take_of_the_day = false where take_of_the_day = true;

  if v_take_id is null then
    return;
  end if;

  -- Mark the winner
  update hot_takes set take_of_the_day = true where id = v_take_id;

  -- Award aura once per calendar day
  select exists(
    select 1 from aura_log
     where action     = 'take_of_the_day'
       and created_at >= date_trunc('day', now())
  ) into v_already_awarded;

  if not v_already_awarded then
    perform award_aura(v_user_id, 'take_of_the_day', 100, v_take_id);
  end if;
end;
$$;

grant execute on function update_take_of_the_day() to authenticated;

-- ── 4. check_hot_streak() ─────────────────────────────────────────────────────
-- Called when a hot take's flame count first reaches exactly 10.
-- Increments the owner's hot_take_streak.
-- At 3 consecutive, awards +50 Aura (date-scoped, one per day) and resets streak.

create or replace function check_hot_streak(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_streak   integer;
  v_today    date := current_date;
  v_date_ref uuid;
begin
  select hot_take_streak
    into v_streak
    from profiles
   where id = p_user_id
     for update;

  v_streak := coalesce(v_streak, 0) + 1;

  if v_streak >= 3 then
    -- Deterministic UUID — prevents double-awarding on the same day
    v_date_ref := uuid_generate_v5(
      '6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid,
      p_user_id::text || ':hot_streak:' || v_today::text
    );
    perform award_aura(p_user_id, 'hot_streak', 50, v_date_ref);
    update profiles set hot_take_streak = 0 where id = p_user_id;
  else
    update profiles set hot_take_streak = v_streak where id = p_user_id;
  end if;
end;
$$;

grant execute on function check_hot_streak(uuid) to authenticated;
