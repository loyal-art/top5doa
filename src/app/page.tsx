import { createClient } from "@/lib/supabase/server";
import { HomeClient } from "./home-client";

export type TopicStat = {
  id: string;
  title: string;
  slug: string;
  category: string;
  description: string | null;
  created_at: string;
  voterCount: number;
  attributes: string[];
  globalTop3: { rank: number; name: string; era: string | null }[];
  userVoted: boolean;
};

export default async function Home() {
  const supabase = await createClient();

  // ── Active topics ──────────────────────────────────────────────────────────
  const { data: topicRows } = await supabase
    .from("topics")
    .select("id, title, slug, category, description, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const topics = topicRows ?? [];
  const topicIds = topics.map((t) => t.id);

  if (topicIds.length === 0) {
    return <HomeClient topics={[]} isPremium={false} />;
  }

  // ── Rank-1 rows (one per user per topic = each user's locked #1 pick) ────
  const { data: listRows } = await supabase
    .from("user_lists")
    .select("user_id, topic_id, subject_id")
    .in("topic_id", topicIds)
    .eq("rank_position", 1);

  // Voter counts + subject vote tallies per topic
  const voterSets: Record<string, Set<string>> = {};
  const subjectVotes: Record<string, Record<string, number>> = {};
  for (const row of listRows ?? []) {
    if (!voterSets[row.topic_id]) voterSets[row.topic_id] = new Set();
    voterSets[row.topic_id].add(row.user_id);
    if (!subjectVotes[row.topic_id]) subjectVotes[row.topic_id] = {};
    subjectVotes[row.topic_id][row.subject_id] =
      (subjectVotes[row.topic_id][row.subject_id] ?? 0) + 1;
  }

  // Collect subject IDs needed for the top-3 labels
  const neededSubjectIds = new Set<string>();
  for (const topicId of topicIds) {
    Object.entries(subjectVotes[topicId] ?? {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .forEach(([id]) => neededSubjectIds.add(id));
  }

  const { data: subjectRows } =
    neededSubjectIds.size > 0
      ? await supabase
          .from("subjects")
          .select("id, name, era")
          .in("id", [...neededSubjectIds])
      : { data: [] };
  const subjectMap = Object.fromEntries(
    (subjectRows ?? []).map((s) => [s.id, s])
  );

  // ── Attributes (up to 4 per topic) ────────────────────────────────────────
  const { data: attrRows } = await supabase
    .from("attributes")
    .select("topic_id, name")
    .in("topic_id", topicIds)
    .eq("status", "active");

  const attrsByTopic: Record<string, string[]> = {};
  for (const row of attrRows ?? []) {
    if (!attrsByTopic[row.topic_id]) attrsByTopic[row.topic_id] = [];
    if (attrsByTopic[row.topic_id].length < 4)
      attrsByTopic[row.topic_id].push(row.name);
  }

  // ── Current viewer ─────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  let userVotedIds = new Set<string>();
  let isPremium = false;

  if (viewerId) {
    const [{ data: myLists }, { data: profile }] = await Promise.all([
      supabase
        .from("user_lists")
        .select("topic_id")
        .eq("user_id", viewerId)
        .eq("rank_position", 1),
      supabase
        .from("profiles")
        .select("is_premium")
        .eq("id", viewerId)
        .single(),
    ]);
    userVotedIds = new Set((myLists ?? []).map((r) => r.topic_id));
    isPremium = profile?.is_premium ?? false;
  }

  // ── Build final topic data ─────────────────────────────────────────────────
  const topicsWithStats: TopicStat[] = topics.map((t) => {
    const votes = subjectVotes[t.id] ?? {};
    const globalTop3 = Object.entries(votes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([subId], idx) => ({
        rank: idx + 1,
        name: subjectMap[subId]?.name ?? "Unknown",
        era: subjectMap[subId]?.era ?? null,
      }));
    return {
      id: t.id,
      title: t.title,
      slug: t.slug,
      category: t.category,
      description: t.description,
      created_at: t.created_at,
      voterCount: voterSets[t.id]?.size ?? 0,
      attributes: attrsByTopic[t.id] ?? [],
      globalTop3,
      userVoted: userVotedIds.has(t.id),
    };
  });

  return <HomeClient topics={topicsWithStats} isPremium={isPremium} />;
}
