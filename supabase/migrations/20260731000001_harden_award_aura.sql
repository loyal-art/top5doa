-- Harden award_aura against client-supplied trust.
--
-- PROBLEM
-- award_aura is SECURITY DEFINER and accepted BOTH the target user and the
-- point value from the caller. Since most writes in this app go browser ->
-- Postgres directly, any logged-in user could open a console and run:
--
--   supabase.rpc('award_aura', { p_user_id: <any uuid>, p_action: 'vote',
--                                p_points: 999999 })
--
-- ...awarding themselves, or anyone else, an arbitrary amount of aura. Aura
-- drives the leaderboard, the tier badges and the poster-regeneration cost,
-- so this is the whole reputation system.
--
-- FIX
-- 1. Base points are derived server-side from the action. p_points is now
--    ignored for every fixed-value action.
--
--    The streak multiplier still applies, but it is read from
--    profiles.streak_multiplier rather than taken from the caller. The client
--    calls update_streak() immediately before award_aura(), so the stored
--    value is current by the time we read it. This reproduces the previous
--    behaviour exactly -- client-side it was Math.round(base * multiplier)
--    when multiplier > 1 -- without trusting the number.
--
--    p_points is still honoured for streak_bonus and combo_bonus, which are
--    variable by design and are only invoked from other SECURITY DEFINER
--    functions (update_streak, check_combo_bonus), not from the browser.
--
-- 2. A caller may only award aura to themselves, EXCEPT for the two actions
--    that are legitimately cross-user. Those are verified against the
--    underlying row rather than taken on trust:
--      - receive_follow: the caller must actually follow the target.
--      - flame:          the target must be the hot take's author, and the
--                        caller must actually hold a flame vote on it.
--
-- The signature is unchanged, so no application code needs to change.

create or replace function award_aura(
  p_user_id      uuid,
  p_action       text,
  p_points       integer,
  p_reference_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists     boolean := false;
  v_new_points integer;
  v_day_count  integer;
  v_caller     uuid    := auth.uid();
  v_base       integer;
  v_mult       numeric;
  v_points     integer;
begin
  -- ── Guard 1: who may award to whom ────────────────────────────────────────
  -- v_caller is null when invoked from a trusted server context (service role)
  -- or from another SECURITY DEFINER function; those paths stay trusted.
  if v_caller is not null and p_user_id <> v_caller then
    if p_action = 'receive_follow' then
      if not exists (
        select 1 from follows
        where follower_id  = v_caller
          and following_id = p_user_id
      ) then
        return false;
      end if;

    elsif p_action = 'flame' then
      -- p_reference_id is the hot take id.
      if not exists (
        select 1
        from hot_takes ht
        join hot_take_votes htv on htv.hot_take_id = ht.id
        where ht.id        = p_reference_id
          and ht.user_id   = p_user_id
          and htv.user_id  = v_caller
          and htv.vote_type = 'flame'
      ) then
        return false;
      end if;

    else
      return false;
    end if;
  end if;

  -- ── Guard 2: derive points server-side ────────────────────────────────────
  v_base := case p_action
    when 'vote'            then 10
    when 'share'           then 25
    when 'receive_follow'  then 10
    when 'follow'          then 1
    when 'flame'           then 2
    when 'suggest_topic'   then 3
    when 'suggestion_vote' then 1
    when 'create_topic'    then 20
    else null
  end;

  if v_base is not null then
    select coalesce(streak_multiplier, 1.0)
    into   v_mult
    from   profiles
    where  id = p_user_id;

    if v_mult is null or v_mult < 1 then
      v_mult := 1.0;
    end if;

    v_points := round(v_base * v_mult);

  elsif p_action in ('streak_bonus', 'combo_bonus') then
    -- Variable amounts, set by trusted SQL callers only.
    v_points := p_points;

  else
    -- Unknown action: refuse rather than award an unbounded amount.
    return false;
  end if;

  -- ── Original body from here down, with p_points -> v_points ───────────────

  -- Duplicate-guard: same user + action + reference_id combination
  if p_reference_id is not null then
    select exists(
      select 1 from aura_log
      where user_id      = p_user_id
        and action       = p_action
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
  values (p_user_id, p_action, v_points, p_reference_id);

  -- Increment aura_points and recalculate tier
  update profiles
  set aura_points = aura_points + v_points,
      tier        = get_aura_tier(aura_points + v_points),
      updated_at  = now()
  where id = p_user_id
  returning aura_points into v_new_points;

  return true;
end;
$$;

grant execute on function award_aura(uuid, text, integer, uuid) to authenticated;
