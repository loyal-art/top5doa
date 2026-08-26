-- Supabase advisor cleanup.
-- 1. Pin search_path on remaining non-definer functions flagged by the linter.
ALTER FUNCTION public.update_updated_at() SET search_path = public;
ALTER FUNCTION public.get_aura_tier(integer) SET search_path = public;

-- 2. notify_new_topic performs its own internal admin check, but anon has no
--    legitimate reason to call it. Defense in depth.
REVOKE EXECUTE ON FUNCTION public.notify_new_topic(uuid, text, text) FROM PUBLIC, anon;
