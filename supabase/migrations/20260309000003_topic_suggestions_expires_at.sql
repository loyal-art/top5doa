-- Add expires_at to topic_suggestions — defaults to 30 days after creation
alter table public.topic_suggestions
  add column expires_at timestamptz not null default (now() + interval '30 days');

-- Backfill existing rows
update public.topic_suggestions
  set expires_at = created_at + interval '30 days'
  where expires_at is null or expires_at = now() + interval '30 days';
