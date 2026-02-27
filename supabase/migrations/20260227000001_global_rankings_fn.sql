-- ============================================================================
-- Global Rankings Function
-- Computes the community consensus ranking for a topic by averaging every
-- user's individually-weighted subject scores.
--
-- Algorithm per user per subject:
--   weighted_score = SUM(score[attr] * weights[rank_position[attr] - 1] / 100)
-- Global score = AVG(weighted_score) across all users who have voted.
--
-- security definer so it can read user_attribute_ranks and user_subject_scores
-- across all users regardless of the row-level security policies on those tables.
-- ============================================================================

create or replace function get_global_rankings(p_topic_id uuid)
returns table (subject_id uuid, avg_score numeric)
language sql
security definer
stable
set search_path = ''
as $$
  with user_scores as (
    select
      ss.user_id,
      ss.subject_id,
      sum(
        ss.score
        * (sc.weights ->>(uar.rank_position - 1))::numeric
        / 100
      ) as weighted_score
    from public.user_subject_scores ss
    join public.user_attribute_ranks uar
      on  uar.user_id      = ss.user_id
      and uar.topic_id     = ss.topic_id
      and uar.attribute_id = ss.attribute_id
    cross join lateral (
      select sc2.weights
      from public.scoring_configs sc2
      where sc2.attribute_count = (
        select count(*)::int
        from public.attributes a
        where a.topic_id = p_topic_id
          and a.status in ('active', 'approved')
      )
      and sc2.active = true
      limit 1
    ) sc
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

-- Allow both anonymous and authenticated callers to invoke this function.
-- It only returns aggregated scores — no raw per-user data is exposed.
grant execute on function get_global_rankings(uuid) to anon, authenticated;
