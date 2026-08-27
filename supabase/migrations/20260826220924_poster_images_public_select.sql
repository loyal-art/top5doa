-- Restore public read on poster_images, and add the missing owner UPDATE policy.
--
-- Drift note: 20260321000003_poster_images.sql declares a public SELECT policy
-- ("Anyone can view posters (they're shareable)") plus owner-scoped
-- insert/update/delete. The live database does not match it — it carries
-- owner-only SELECT for `authenticated`, and no UPDATE policy at all. Those
-- policies were applied outside the migration history, so this migration
-- reconciles the live state with the documented intent rather than assuming
-- the file was ever applied.
--
-- Why public SELECT is needed: a social crawler fetching a shared list page is
-- unauthenticated. generateMetadata resolves as `anon`, so without a public
-- policy the og:image lookup returns zero rows and silently falls back to the
-- static image on every request — the Open Graph work would appear to ship and
-- do nothing.
--
-- SEQUENCING: run scripts/backfill-poster-storage.mjs BEFORE applying this.
-- Pre-backfill, image_data holds a ~2MB base64 PNG; post-backfill it holds a
-- short public URL. Opening SELECT first would let every anonymous crawler hit
-- pull megabytes out of Postgres.
--
-- Nothing in this table is sensitive: user_id, topic_id, style, values_tagline,
-- created_at, and an image that is already public via the `posters` bucket.

-- ── Public read ──────────────────────────────────────────────────────────────
-- No `to` clause, so this applies to PUBLIC (anon included).
drop policy if exists "poster_images_public_select" on public.poster_images;
create policy "poster_images_public_select" on public.poster_images
  for select
  using (true);

-- The pre-existing owner-only SELECT policy ("Users can read own posters") is
-- left in place. Postgres ORs permissive policies together, so it is now
-- redundant but harmless, and dropping a policy this migration did not create
-- would be a silent change to state applied outside the migration history.

-- ── Owner update ─────────────────────────────────────────────────────────────
-- The app currently does delete-then-insert rather than update, and the backfill
-- runs as service_role (which bypasses RLS), so nothing depends on this today.
-- It is added because its absence is unintended — the original migration
-- declares it — and an upsert path would otherwise fail closed with no policy.
drop policy if exists "poster_images_owner_update" on public.poster_images;
create policy "poster_images_owner_update" on public.poster_images
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
