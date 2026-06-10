-- ── notify_new_topic(): global-premium alert fan-out ─────────────────────────
-- While GLOBAL_PREMIUM_ENABLED (src/lib/config.ts) treats every account as
-- premium, new-topic alerts must fan out to ALL subscribed users, not just
-- those with is_premium = true.  This replaces notify_new_topic with the
-- premium filter removed; the original predicate is kept in a comment below
-- so it can be restored when billing goes live.

CREATE OR REPLACE FUNCTION notify_new_topic(
  p_topic_id UUID,
  p_category TEXT,
  p_title    TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admin callers are permitted.
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO notifications (user_id, type, title, message, topic_id)
  SELECT
    p.id,
    'new_topic',
    'New ' || p_category || ' Topic',
    '"' || p_title || '" is now live — cast your vote!',
    p_topic_id
  FROM profiles p
  INNER JOIN user_category_preferences ucp ON ucp.user_id = p.id
  WHERE ucp.category = p_category;
    -- Restore this predicate when real premium checks resume:
    -- AND p.is_premium = true;
END;
$$;
