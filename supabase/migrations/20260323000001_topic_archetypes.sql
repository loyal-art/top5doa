CREATE TABLE IF NOT EXISTS topic_archetypes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id uuid REFERENCES topics(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  base_description text NOT NULL,
  icon text DEFAULT '🏆',
  attribute_weights jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_archetypes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) NOT NULL,
  topic_id uuid REFERENCES topics(id) ON DELETE CASCADE NOT NULL,
  primary_archetype_id uuid REFERENCES topic_archetypes(id) NOT NULL,
  secondary_archetype_id uuid REFERENCES topic_archetypes(id),
  primary_score numeric NOT NULL DEFAULT 0,
  secondary_score numeric NOT NULL DEFAULT 0,
  primary_margin numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, topic_id)
);

ALTER TABLE topic_archetypes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_archetypes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read topic archetypes" ON topic_archetypes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert topic archetypes" ON topic_archetypes FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

CREATE POLICY "Admins can update topic archetypes" ON topic_archetypes FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

CREATE POLICY "Admins can delete topic archetypes" ON topic_archetypes FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

CREATE POLICY "Anyone can read user archetypes" ON user_archetypes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own archetypes" ON user_archetypes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own archetypes" ON user_archetypes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
