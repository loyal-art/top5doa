-- ============================================================================
-- TOP5DOA — Combo Bonus System
-- Awards +10 Aura when a user performs 3 qualifying actions within 10 minutes.
-- Uses a deterministic reference_id per 10-minute window to prevent duplicates.
-- ============================================================================

create or replace function check_combo_bonus(p_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_action_count integer;
  v_combo_ref    uuid;
  v_awarded      boolean;
begin
  -- Count qualifying actions in the last 10 minutes
  select count(*) into v_action_count
  from aura_log
  where user_id    = p_user_id
    and created_at > now() - interval '10 minutes'
    and action not in ('streak_bonus', 'combo_bonus');

  -- Only award on exactly 3 (the trigger point)
  if v_action_count <> 3 then
    return false;
  end if;

  -- Build a deterministic reference_id for the current 10-minute window.
  -- This prevents multiple combo bonuses in the same window because
  -- award_aura deduplicates on (user_id, action, reference_id).
  v_combo_ref := uuid_generate_v5(
    uuid_nil(),
    'combo-' || p_user_id::text
      || '-' || date_trunc('hour', now())::text
      || '-' || floor(extract(minute from now()) / 10)::text
  );

  -- Award combo bonus (+10) via the existing award_aura function
  select award_aura(p_user_id, 'combo_bonus', 10, v_combo_ref)
  into v_awarded;

  return v_awarded;
end;
$$;

grant execute on function check_combo_bonus(uuid) to authenticated;
