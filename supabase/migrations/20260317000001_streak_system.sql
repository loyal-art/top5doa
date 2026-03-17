-- ============================================================================
-- TOP5DOA — Daily Streak & Momentum Multiplier
-- Creates update_streak() RPC called on every aura-earning action.
-- ============================================================================

-- update_streak(p_user_id)
--   • Reads last_active_date, daily_streak, streak_multiplier from profiles.
--   • If last_active_date is already today  → no-op, return current multiplier.
--   • If last_active_date was yesterday     → increment streak by 1.
--   • If last_active_date was 2 days ago    → grace period: keep streak, update date.
--   • If last_active_date was >2 days ago   → reset streak to 1, multiplier to 1.0.
--   • Recalculates multiplier:  0 days=1.0 / 3+=1.25 / 7+=1.50 / 14+=1.75 / 30+=2.0
--   • Awards streak milestone bonus aura for days 1, 3, 7, 14, 30.
--   • Returns the new streak_multiplier so the caller can apply it.

create or replace function update_streak(p_user_id uuid)
returns numeric   -- new streak_multiplier
language plpgsql
security definer
as $$
declare
  v_last_date   date;
  v_streak      integer;
  v_multiplier  numeric(6,2);
  v_today       date          := current_date;
  v_days_since  integer;
  v_new_streak  integer;
  v_new_mult    numeric(6,2);
  v_bonus       integer       := 0;
  v_bonus_ref   uuid;
begin
  -- Lock the row to prevent concurrent streak updates
  select last_active_date, daily_streak, streak_multiplier
  into   v_last_date, v_streak, v_multiplier
  from   profiles
  where  id = p_user_id
  for update;

  -- Already updated today — return immediately, nothing to change
  if v_last_date = v_today then
    return v_multiplier;
  end if;

  -- How many days since last active?
  v_days_since := case
    when v_last_date is null then 999   -- never been active
    else v_today - v_last_date
  end;

  -- Determine new streak value
  v_new_streak := case
    when v_days_since = 1 then v_streak + 1   -- consecutive day: increment
    when v_days_since = 2 then v_streak       -- grace period: keep as-is
    else                       1              -- broken or first-ever: reset to 1
  end;

  -- Determine new multiplier
  v_new_mult := case
    when v_new_streak >= 30 then 2.00
    when v_new_streak >= 14 then 1.75
    when v_new_streak >= 7  then 1.50
    when v_new_streak >= 3  then 1.25
    else                         1.00
  end;

  -- Persist updated streak state
  update profiles
  set    daily_streak      = v_new_streak,
         last_active_date  = v_today,
         streak_multiplier = v_new_mult,
         updated_at        = now()
  where  id = p_user_id;

  -- Streak milestone bonus — only on increment or reset days (not grace-period days)
  if v_days_since <> 2 then
    v_bonus := case v_new_streak
      when 1  then 5
      when 3  then 10
      when 7  then 25
      when 14 then 75
      when 30 then 200
      else         0
    end;
  end if;

  if v_bonus > 0 then
    -- Deterministic UUID based on user + date prevents double awards on the same day
    v_bonus_ref := uuid_generate_v5(
      '6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid,   -- RFC 4122 DNS namespace
      p_user_id::text || ':streak_bonus:' || v_today::text
    );
    perform award_aura(p_user_id, 'streak_bonus', v_bonus, v_bonus_ref);
  end if;

  return v_new_mult;
end;
$$;

grant execute on function update_streak(uuid) to authenticated;
