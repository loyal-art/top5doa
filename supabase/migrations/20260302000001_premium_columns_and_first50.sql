-- ============================================================================
-- Add is_premium + premium_expires_at to profiles; grant first 50 users premium
-- ============================================================================

-- 1. New columns on profiles -------------------------------------------------

alter table public.profiles
  add column if not exists is_premium          boolean     not null default false,
  add column if not exists premium_expires_at  timestamptz;

-- 2. Grant premium to the first 50 users (by created_at) --------------------

update public.profiles
set
  is_premium         = true,
  premium_expires_at = now() + interval '1 month'
where id in (
  select id
  from   public.profiles
  order  by created_at asc
  limit  50
);

-- 3. Update handle_new_user() to auto-premium the first 50 signups -----------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_signup_count integer;
  v_is_premium   boolean := false;
  v_expires_at   timestamptz;
begin
  -- Count existing profiles to decide if this is among the first 50
  select count(*) into v_signup_count from public.profiles;

  if v_signup_count < 50 then
    v_is_premium := true;
    v_expires_at := now() + interval '1 month';
  end if;

  insert into public.profiles (id, display_name, avatar_url, username, is_premium, premium_expires_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', 'User'),
    new.raw_user_meta_data ->> 'avatar_url',
    lower(
      regexp_replace(
        trim(coalesce(
          new.raw_user_meta_data ->> 'display_name',
          new.raw_user_meta_data ->> 'full_name',
          'user'
        )),
        '[^a-zA-Z0-9]+', '_', 'g'
      )
    ) || substr(replace(new.id::text, '-', ''), 1, 6),
    v_is_premium,
    v_expires_at
  );

  insert into public.user_credits (user_id, balance)
  values (new.id, 0);

  return new;
end;
$$;
