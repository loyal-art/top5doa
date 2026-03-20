-- Allow authenticated users to update hot_takes counters (flames/trashes).
-- The original migration only had SELECT, INSERT, DELETE policies, so
-- client-side .update() calls to increment/decrement counters were
-- silently blocked by RLS.

create policy "Authenticated users can update hot take counters"
  on hot_takes for update
  using (true)
  with check (true);
