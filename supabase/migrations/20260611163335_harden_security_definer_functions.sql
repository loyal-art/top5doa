-- Security hardening (interim): SECURITY DEFINER functions were executable
-- by PUBLIC/anon with no internal auth checks, exposing award_aura and the
-- streak/bonus functions as unauthenticated REST endpoints.
--
-- TODO (tracked): add a server-side action->points whitelist inside
-- award_aura so signed-in users cannot self-award arbitrary point values.
REVOKE EXECUTE ON FUNCTION public.award_aura(uuid, text, integer, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_streak(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_combo_bonus(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_hot_streak(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_viral_milestones(uuid, uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_topic_view(uuid) FROM PUBLIC, anon;

-- Trigger/cron-only functions (defense in depth; not RPC-callable in practice)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_take_of_the_day() FROM PUBLIC, anon;

-- Pin search_path on all definer functions missing it (search-path hijack hardening)
ALTER FUNCTION public.award_aura(uuid, text, integer, uuid) SET search_path = public;
ALTER FUNCTION public.update_streak(uuid) SET search_path = public;
ALTER FUNCTION public.check_combo_bonus(uuid) SET search_path = public;
ALTER FUNCTION public.check_hot_streak(uuid) SET search_path = public;
ALTER FUNCTION public.check_viral_milestones(uuid, uuid, integer) SET search_path = public;
ALTER FUNCTION public.increment_topic_view(uuid) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.update_take_of_the_day() SET search_path = public;
