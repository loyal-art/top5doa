-- Security fix (interim): hot_takes UPDATE policy is USING (true) because
-- flame/trash reactions are direct client-side counter updates performed by
-- users other than the take's author. An owner-only policy would break
-- reactions, so instead restrict the UPDATE grant to the counter columns:
-- content and ownership fields can no longer be modified by non-owners.
--
-- TODO (tracked): replace with a react_to_take() SECURITY DEFINER RPC that
-- enforces one reaction per user, then revoke counter updates entirely.
REVOKE UPDATE ON public.hot_takes FROM authenticated, anon;

GRANT UPDATE (flames, trashes) ON public.hot_takes TO authenticated;
