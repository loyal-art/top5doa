-- ============================================================================
-- Global Rankings Function
-- Computes the community consensus ranking for a topic by averaging every
-- user's individually-weighted subject scores.
--
-- Algorithm per user per subject:
--   weighted_score = SUM(score[attr] * weights[rank_position[attr] - 1] / 100)
-- Global score    = AVG(weighted_score) across all users who have voted.
--
-- Uses security definer so the function can read user_attribute_ranks and
-- user_subject_scores across all users regardless of RLS policies.
-- Only aggregated scores are returned — no raw per-user data is exposed.
-- ============================================================================

create or replace function get_global_rankings(p_topic_id uuid)
returns table (subject_id uuid, avg_score numeric)
language sql
security definer
stable
set search_path = ''
as $$
  with attr_count as (
    -- Snapshot the active attribute count once so every row in the join sees
    -- the same value (avoids recalculating it per-row in a lateral).
    select count(*)::int as n
    from public.attributes a
    where a.topic_id = p_topic_id
      and a.status in ('active', 'approved')
  ),
  weights_cfg as (
    select sc.weights
    from public.scoring_configs sc, attr_count ac
    where sc.attribute_count = ac.n
      and sc.active = true
    limit 1
  ),
  user_scores as (
    -- For each (user, subject) pair: sum each attribute score multiplied by the
    -- weight that corresponds to the user's rank position for that attribute.
    select
      ss.user_id,
      ss.subject_id,
      sum(
        ss.score
        * (wc.weights ->>(uar.rank_position - 1))::numeric
        / 100
      ) as weighted_score
    from public.user_subject_scores ss
    join public.user_attribute_ranks uar
      on  uar.user_id      = ss.user_id
      and uar.topic_id     = ss.topic_id
      and uar.attribute_id = ss.attribute_id
    join weights_cfg wc on true          -- cross join the single config row
    where ss.topic_id = p_topic_id
    group by ss.user_id, ss.subject_id
  )
  select
    subject_id,
    round(avg(weighted_score), 2) as avg_score
  from user_scores
  group by subject_id
  order by avg_score desc;
$$;

-- Allow anonymous and authenticated callers to invoke this function.
grant execute on function get_global_rankings(uuid) to anon, authenticated;
