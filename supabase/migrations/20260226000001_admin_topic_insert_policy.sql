-- Admins were missing an INSERT policy on topics.
-- The existing "Admins can update topics" only covers UPDATE;
-- without an INSERT policy, admin inserts are blocked by RLS.
create policy "Admins can insert topics"
  on topics for insert with check (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );
