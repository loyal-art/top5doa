-- Posters move out of Postgres and into Supabase Storage.
--
-- poster_images.image_data currently holds a raw base64 PNG (~2MB per row).
-- That is a scaling ceiling on the 500MB database tier, it bloats the profile
-- page's RSC payload, and it cannot serve an og:image — a social crawler needs
-- a fast CDN URL, not a 2MB read out of Postgres.
--
-- After this migration, image_data holds a public URL instead. The column stays
-- `text not null`, so no schema change is required and legacy base64 rows keep
-- working until they are backfilled.

-- ── Bucket ───────────────────────────────────────────────────────────────────
-- Public, not signed. poster_images RLS is already `select using (true)`
-- ("Anyone can view posters (they're shareable)"), so this widens nothing.
-- Anonymous crawlers must be able to fetch og:image, and signed URLs expire —
-- which would silently break every previously shared link.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('posters', 'posters', true, 10485760, array['image/png'])
on conflict (id) do update
  set public            = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── Policies on storage.objects ──────────────────────────────────────────────
-- Object key convention: {user_id}/{topic_id}.png
-- Keying ownership on the first folder segment is the standard Supabase idiom
-- and keeps the check to a single expression. Both segments are UUIDs, so the
-- path leaks nothing about the user.

drop policy if exists "posters_public_read" on storage.objects;
create policy "posters_public_read" on storage.objects
  for select
  using (bucket_id = 'posters');

drop policy if exists "posters_owner_insert" on storage.objects;
create policy "posters_owner_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'posters'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Regenerating a poster upserts to the same deterministic key, so update is
-- required alongside insert.
drop policy if exists "posters_owner_update" on storage.objects;
create policy "posters_owner_update" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'posters'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'posters'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "posters_owner_delete" on storage.objects;
create policy "posters_owner_delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'posters'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
