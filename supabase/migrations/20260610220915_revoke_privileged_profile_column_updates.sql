-- Security fix: prevent privilege escalation via direct REST API updates.
-- RLS "Users can update their own profile" permits row-level updates, but
-- column grants previously allowed authenticated users to set is_admin,
-- is_premium, premium_expires_at, and tier on their own row.
--
-- NOTE: This migration is a NO-OP. Column-level REVOKE does not remove
-- privileges granted at the table level. Superseded by
-- 20260611002439_profiles_update_column_allowlist.sql, which revokes the
-- table-level grant and re-grants an explicit column allowlist.
-- Retained for accurate migration history.
REVOKE UPDATE (is_admin, is_premium, premium_expires_at, tier)
ON public.profiles FROM authenticated, anon;
