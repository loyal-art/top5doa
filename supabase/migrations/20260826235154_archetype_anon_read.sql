-- Let logged-out visitors read archetypes.
--
-- The public list page reveals the list owner's archetype to everyone — it is
-- the shareable identity hook, and it stays visible even when positions 2-5 are
-- spoiler-gated. A logged-out visitor resolves as `anon`, so without this the
-- archetype silently disappears for exactly the audience the share loop targets.
--
-- Drift note: the existing policies are already named "Anyone can read topic
-- archetypes" / "Anyone can read user archetypes" and both use `using (true)`,
-- so public read was clearly the intent. They are scoped `to authenticated`,
-- which excludes anon and defeats it. These policies were applied outside the
-- migration history, so rather than alter them this migration adds explicit
-- anon-readable policies alongside; Postgres ORs permissive policies together.
--
-- Neither table holds anything sensitive. topic_archetypes is authored content
-- (name, description, icon, attribute weights). user_archetypes links a user to
-- the archetype they were assigned for a topic — the same fact the page renders.

drop policy if exists "topic_archetypes_public_select" on public.topic_archetypes;
create policy "topic_archetypes_public_select" on public.topic_archetypes
  for select
  using (true);

drop policy if exists "user_archetypes_public_select" on public.user_archetypes;
create policy "user_archetypes_public_select" on public.user_archetypes
  for select
  using (true);
