-- ============================================================================
-- Fix: get_global_rankings — correct JOIN condition on user_attribute_ranks
--
-- Bug: the previous version used `uar.topic_id = ss.topic_id` in the JOIN,
-- relying on the query planner to push the WHERE ss.topic_id = p_topic_id
-- filter transitively across to user_attribute_ranks.  In practice the
-- planner may not push that predicate into the nested-loop inner side before
-- scanning, causing it to read every rank row for the user across *all*
-- topics and then discard mismatches — or, if the stats are stale, produce
-- a poor plan that results in 0 rows when votes do exist.
--
-- Fix: join user_attribute_ranks directly on p_topic_id so the predicate is
-- visible to the index on (user_id, topic_id) without relying on transitivity.
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
      and uar.topic_id     = p_topic_id          -- explicit: no longer relies on ss.topic_id transitivity
      and uar.attribute_id = ss.attribute_id
    join weights_cfg wc on true                   -- cross join the single config row
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

-- Grants are preserved from the original migration.
grant execute on function get_global_rankings(uuid) to anon, authenticated;
