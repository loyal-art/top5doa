-- ── user_category_preferences ───────────────────────────────────────────────
-- Stores which topic categories a premium user wants alerts for.

CREATE TABLE user_category_preferences (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category   TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);

ALTER TABLE user_category_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ucp_own_select"
  ON user_category_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "ucp_own_insert"
  ON user_category_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ucp_own_delete"
  ON user_category_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- ── notifications ────────────────────────────────────────────────────────────
-- Persistent in-app notifications for premium users.

CREATE TABLE notifications (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL,
  title      TEXT        NOT NULL,
  message    TEXT        NOT NULL,
  topic_id   UUID        REFERENCES topics(id) ON DELETE SET NULL,
  read       BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_own_select"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notif_own_update"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── notify_new_topic() ───────────────────────────────────────────────────────
-- SECURITY DEFINER function called by admin server actions after a topic is
-- created.  Bypasses RLS so it can read all category preferences and insert
-- notifications for any premium subscriber.

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
  WHERE ucp.category = p_category
    AND p.is_premium = true;
END;
$$;

-- Restrict direct invocation to authenticated users only; the internal admin
-- check provides a second layer of protection.
REVOKE EXECUTE ON FUNCTION notify_new_topic(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION notify_new_topic(UUID, TEXT, TEXT) TO authenticated;
