-- Security fix (corrected): privilege escalation via profiles UPDATE.
-- Prior targeted column REVOKE (20260610220915) was a no-op because roles
-- held a table-level UPDATE grant. Correct approach: revoke table-wide
-- UPDATE, then re-grant an explicit allowlist of safe columns to
-- authenticated only.
--
-- Gamification columns (aura_points, daily_streak, streak_multiplier,
-- hot_take_streak) remain client-updatable pending migration of those
-- writes into SECURITY DEFINER functions.
REVOKE UPDATE ON public.profiles FROM authenticated, anon;

GRANT UPDATE (display_name, avatar_url, username, is_public,
              aura_points, daily_streak, last_active_date,
              streak_multiplier, hot_take_streak)
ON public.profiles TO authenticated;
