-- ============================================================================
-- TOP5DOA — Seed Data (development only)
-- ============================================================================
-- Run after migrations to populate example data for local development.
-- This file should NOT be run in production.
-- ============================================================================

-- Credit bundles (Stripe price IDs are placeholders for dev)
insert into credit_bundles (name, credit_amount, price_cents, stripe_price_id) values
  ('Starter Pack',  5,   150, 'price_dev_starter_5'),
  ('Value Pack',    15,  400, 'price_dev_value_15'),
  ('Pro Pack',      50,  1200, 'price_dev_pro_50');

-- ============================================================================
-- TEST USER — admin + premium for local dev
-- ============================================================================
-- Login: admin@top5doa.test / password123

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
) values (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin@top5doa.test',
  '$2a$10$PznUGzshVgEHMGxIYJPSRe2bGHFsNqRjM.V3pLKedHGGfNwB5Gwae',
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"display_name": "Top5 Admin"}',
  now(),
  now(),
  '',
  ''
);

-- The handle_new_user() trigger auto-created the profile and credits row.
-- Now upgrade to admin + premium.
update profiles
  set tier = 'premium', is_admin = true
  where id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- ============================================================================
-- TOPIC 1: Greatest NBA Player of All Time
-- ============================================================================

insert into topics (id, title, slug, category, description, status, creator_id) values (
  '11111111-1111-1111-1111-111111111111',
  'Greatest NBA Player of All Time',
  'greatest-nba-player',
  'Sports',
  'Who is the GOAT? Rank the attributes that matter most, then score each legend from 1–99.',
  'active',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

-- Subjects (NBA players)
insert into subjects (topic_id, name, era, stats) values
  ('11111111-1111-1111-1111-111111111111', 'Michael Jordan',      '1984–2003', '{"ppg": 30.1, "rpg": 6.2, "apg": 5.3, "rings": 6}'),
  ('11111111-1111-1111-1111-111111111111', 'LeBron James',        '2003–present', '{"ppg": 27.1, "rpg": 7.5, "apg": 7.4, "rings": 4}'),
  ('11111111-1111-1111-1111-111111111111', 'Kobe Bryant',         '1996–2016', '{"ppg": 25.0, "rpg": 5.2, "apg": 4.7, "rings": 5}'),
  ('11111111-1111-1111-1111-111111111111', 'Kareem Abdul-Jabbar', '1969–1989', '{"ppg": 24.6, "rpg": 11.2, "apg": 3.6, "rings": 6}'),
  ('11111111-1111-1111-1111-111111111111', 'Magic Johnson',       '1979–1996', '{"ppg": 19.5, "rpg": 7.2, "apg": 11.2, "rings": 5}'),
  ('11111111-1111-1111-1111-111111111111', 'Larry Bird',          '1979–1992', '{"ppg": 24.3, "rpg": 10.0, "apg": 6.3, "rings": 3}'),
  ('11111111-1111-1111-1111-111111111111', 'Tim Duncan',          '1997–2016', '{"ppg": 19.0, "rpg": 10.8, "apg": 3.0, "rings": 5}'),
  ('11111111-1111-1111-1111-111111111111', 'Shaquille O''Neal',   '1992–2011', '{"ppg": 23.7, "rpg": 10.9, "apg": 2.5, "rings": 4}');

-- Attributes (4 active → weights [40, 30, 20, 10])
insert into attributes (topic_id, name, description, status) values
  ('11111111-1111-1111-1111-111111111111', 'Scoring',     'Ability to put the ball in the basket consistently and in clutch moments.', 'active'),
  ('11111111-1111-1111-1111-111111111111', 'Defense',     'Defensive impact — steals, blocks, on-ball and help defense.', 'active'),
  ('11111111-1111-1111-1111-111111111111', 'Playmaking',  'Court vision, passing ability, and making teammates better.', 'active'),
  ('11111111-1111-1111-1111-111111111111', 'Athleticism', 'Raw physical tools — speed, strength, explosiveness, durability.', 'active');

-- ============================================================================
-- TOPIC 2: Greatest Hip-Hop Artist of All Time
-- ============================================================================

insert into topics (id, title, slug, category, description, status, creator_id) values (
  '22222222-2222-2222-2222-222222222222',
  'Greatest Hip-Hop Artist of All Time',
  'greatest-hip-hop-artist',
  'Music',
  'From golden age to modern era — who really runs hip-hop? Score them across what matters.',
  'active',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

-- Subjects (Hip-hop artists)
insert into subjects (topic_id, name, era, stats) values
  ('22222222-2222-2222-2222-222222222222', 'Tupac Shakur',         '1991–1996', '{"albums": 5, "grammys": 0, "billboard_hits": 12}'),
  ('22222222-2222-2222-2222-222222222222', 'The Notorious B.I.G.', '1994–1997', '{"albums": 2, "grammys": 0, "billboard_hits": 8}'),
  ('22222222-2222-2222-2222-222222222222', 'Jay-Z',                '1996–present', '{"albums": 13, "grammys": 24, "billboard_hits": 21}'),
  ('22222222-2222-2222-2222-222222222222', 'Nas',                  '1994–present', '{"albums": 14, "grammys": 1, "billboard_hits": 9}'),
  ('22222222-2222-2222-2222-222222222222', 'Kendrick Lamar',       '2011–present', '{"albums": 6, "grammys": 17, "billboard_hits": 15}'),
  ('22222222-2222-2222-2222-222222222222', 'Eminem',               '1996–present', '{"albums": 12, "grammys": 15, "billboard_hits": 25}'),
  ('22222222-2222-2222-2222-222222222222', 'Andre 3000',           '1994–present', '{"albums": 7, "grammys": 6, "billboard_hits": 10}'),
  ('22222222-2222-2222-2222-222222222222', 'Lil Wayne',            '1999–present', '{"albums": 13, "grammys": 5, "billboard_hits": 24}');

-- Attributes (5 active → weights [30, 25, 20, 15, 10])
insert into attributes (topic_id, name, description, status) values
  ('22222222-2222-2222-2222-222222222222', 'Lyricism',    'Wordplay, metaphors, storytelling, and depth of bars.', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Flow',        'Cadence, rhythm, delivery, and versatility on the beat.', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Discography', 'Quality and consistency of albums across their career.', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Influence',   'Impact on the culture, other artists, and the genre as a whole.', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Longevity',   'Ability to stay relevant and deliver quality over time.', 'active');
