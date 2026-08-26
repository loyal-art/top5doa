-- Durable, server-side rate limiting for the /api routes.
--
-- Vercel runs many short-lived serverless instances, so an in-memory counter
-- provides close to no protection. This table is the shared counter.
--
-- Access model: RLS is enabled with NO policies and all grants are revoked from
-- anon/authenticated, so no client can read or write the table by any path.
-- The only way in is check_api_rate_limit(), a SECURITY DEFINER function that
-- runs as the table owner (owner bypasses RLS — do NOT add FORCE ROW LEVEL
-- SECURITY here or the function stops working).

create table if not exists public.api_rate_limits (
  identifier    uuid        not null,          -- auth.users.id of the caller
  route         text        not null,          -- logical route key, e.g. 'ai/generate-poster'
  window_start  timestamptz not null,          -- start of the fixed window this row counts
  expires_at    timestamptz not null,          -- window_start + window length; drives cleanup
  request_count integer     not null default 0,
  primary key (identifier, route, window_start)
);

-- Supports the opportunistic sweep of fully-expired windows inside the function.
create index if not exists idx_api_rate_limits_expires_at
  on public.api_rate_limits (expires_at);

alter table public.api_rate_limits enable row level security;

-- No policies are created on purpose: with RLS on and no policy, every
-- non-owner role is denied. The grant revoke is belt-and-braces and also keeps
-- the table out of the PostgREST schema.
revoke all on table public.api_rate_limits from anon, authenticated;

-- ── check_api_rate_limit ─────────────────────────────────────────────────────
-- Atomically increments the counter for (identifier, route, current window) and
-- reports whether the request is allowed. The increment and the read are a
-- single INSERT ... ON CONFLICT DO UPDATE ... RETURNING, so concurrent callers
-- cannot race the way a read-then-write would.
--
-- Fixed-window semantics: requests over the limit still increment, so hammering
-- the endpoint keeps the caller locked out until the window rolls over.
--
-- Returns jsonb: { allowed, count, limit, retry_after_seconds }
create or replace function public.check_api_rate_limit(
  p_identifier      uuid,
  p_route           text,
  p_limit           integer,
  p_window_seconds  integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_expires_at   timestamptz;
  v_count        integer;
begin
  -- A signed-in user must only ever spend their own quota. Without this an
  -- authenticated caller could burn another user's allowance via PostgREST.
  if auth.uid() is null or auth.uid() <> p_identifier then
    raise exception 'rate limit identifier does not match the caller'
      using errcode = '42501';
  end if;

  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit parameters' using errcode = '22023';
  end if;

  -- Cleanup strategy: no cron dependency. Roughly 1 call in 100 sweeps every
  -- fully-expired window across all identifiers. expires_at is stored per row
  -- so windows of different lengths are all handled by the one predicate.
  if random() < 0.01 then
    delete from api_rate_limits where expires_at < now();
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );
  v_expires_at := v_window_start + make_interval(secs => p_window_seconds);

  insert into api_rate_limits (identifier, route, window_start, expires_at, request_count)
  values (p_identifier, p_route, v_window_start, v_expires_at, 1)
  on conflict (identifier, route, window_start)
  do update set request_count = api_rate_limits.request_count + 1
  returning request_count into v_count;

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'count',   v_count,
    'limit',   p_limit,
    'retry_after_seconds',
      greatest(1, ceil(extract(epoch from (v_expires_at - clock_timestamp())))::integer)
  );
end;
$$;

-- CREATE FUNCTION grants EXECUTE to PUBLIC by default — revoke it, then grant
-- only to signed-in users. anon must never be able to reach this.
revoke execute on function public.check_api_rate_limit(uuid, text, integer, integer)
  from public, anon;
grant execute on function public.check_api_rate_limit(uuid, text, integer, integer)
  to authenticated;
