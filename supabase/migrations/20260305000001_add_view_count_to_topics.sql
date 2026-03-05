-- Add view_count column to topics
ALTER TABLE topics ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- RPC to atomically increment view count (bypasses RLS)
CREATE OR REPLACE FUNCTION increment_topic_view(p_topic_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE topics SET view_count = view_count + 1 WHERE id = p_topic_id;
$$;

GRANT EXECUTE ON FUNCTION increment_topic_view(uuid) TO anon, authenticated;
