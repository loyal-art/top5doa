-- Re-grant anon access to the view counter only: topic pages are publicly
-- viewable and anonymous views should be counted.
-- Accepted risk: view-count inflation is cosmetic and carries no economy
-- or privilege impact. All other definer functions remain restricted to
-- authenticated/service_role.
GRANT EXECUTE ON FUNCTION public.increment_topic_view(uuid) TO anon;
