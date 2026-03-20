-- Friend Groups system: groups and group_members tables with RLS

create table public.groups (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create table public.group_members (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

-- Indexes
create index idx_groups_owner on public.groups (owner_id);
create index idx_group_members_group on public.group_members (group_id);
create index idx_group_members_user on public.group_members (user_id);

-- RLS: groups
alter table public.groups enable row level security;

create policy "Users can read groups they own"
  on public.groups for select
  using (auth.uid() = owner_id);

create policy "Users can insert their own groups"
  on public.groups for insert
  with check (auth.uid() = owner_id);

create policy "Users can update their own groups"
  on public.groups for update
  using (auth.uid() = owner_id);

create policy "Users can delete their own groups"
  on public.groups for delete
  using (auth.uid() = owner_id);

-- RLS: group_members
alter table public.group_members enable row level security;

create policy "Users can read members of groups they own"
  on public.group_members for select
  using (
    exists (
      select 1 from public.groups
      where groups.id = group_members.group_id
        and groups.owner_id = auth.uid()
    )
  );

create policy "Users can insert members into groups they own"
  on public.group_members for insert
  with check (
    exists (
      select 1 from public.groups
      where groups.id = group_members.group_id
        and groups.owner_id = auth.uid()
    )
  );

create policy "Users can delete members from groups they own"
  on public.group_members for delete
  using (
    exists (
      select 1 from public.groups
      where groups.id = group_members.group_id
        and groups.owner_id = auth.uid()
    )
  );
