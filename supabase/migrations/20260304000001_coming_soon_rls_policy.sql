-- Allow all authenticated users to view coming_soon topics
create policy "Coming soon topics are viewable by authenticated users"
  on topics for select using (
    status = 'coming_soon' and auth.uid() is not null
  );
