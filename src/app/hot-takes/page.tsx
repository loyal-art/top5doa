import { createClient } from "@/lib/supabase/server";
import { HotTakesClient } from "./hot-takes-client";

export type HotTakeItem = {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  content: string;
  topicId: string;
  topicTitle: string;
  topicSlug: string;
  subjectName: string | null;
  attributeName: string | null;
  flames: number;
  trashes: number;
  createdAt: string;
  takeOfTheDay: boolean;
};

export default async function HotTakesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Update Take of the Day on every page load (safe to run multiple times)
  await supabase.rpc("update_take_of_the_day");

  // Fetch first batch of hot takes
  const { data: takes } = await supabase
    .from("hot_takes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  const allTakes = takes ?? [];

  // Collect unique IDs
  const userIds = [...new Set(allTakes.map((t) => t.user_id))];
  const topicIds = [...new Set(allTakes.map((t) => t.topic_id))];
  const subjectIds = [...new Set(allTakes.filter((t) => t.subject_id).map((t) => t.subject_id!))];
  const attributeIds = [...new Set(allTakes.filter((t) => t.attribute_id).map((t) => t.attribute_id!))];

  // Parallel fetches
  const [profilesRes, topicsRes, subjectsRes, attributesRes] = await Promise.all([
    userIds.length > 0
      ? supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", userIds)
      : { data: [] },
    topicIds.length > 0
      ? supabase.from("topics").select("id, title, slug").in("id", topicIds)
      : { data: [] },
    subjectIds.length > 0
      ? supabase.from("subjects").select("id, name").in("id", subjectIds)
      : { data: [] },
    attributeIds.length > 0
      ? supabase.from("attributes").select("id, name").in("id", attributeIds)
      : { data: [] },
  ]);

  const profileMap = Object.fromEntries(
    (profilesRes.data ?? []).map((p) => [p.id, { username: p.username, displayName: p.display_name, avatarUrl: p.avatar_url }])
  );
  const topicMap = Object.fromEntries(
    (topicsRes.data ?? []).map((t) => [t.id, { title: t.title, slug: t.slug }])
  );
  const subjectMap = Object.fromEntries(
    (subjectsRes.data ?? []).map((s) => [s.id, s.name])
  );
  const attributeMap = Object.fromEntries(
    (attributesRes.data ?? []).map((a) => [a.id, a.name])
  );

  // Fetch user's existing votes
  let userVotes: Record<string, "flame" | "trash"> = {};
  if (user) {
    const takeIds = allTakes.map((t) => t.id);
    if (takeIds.length > 0) {
      const { data: votes } = await supabase
        .from("hot_take_votes")
        .select("hot_take_id, vote_type")
        .eq("user_id", user.id)
        .in("hot_take_id", takeIds);
      userVotes = Object.fromEntries(
        (votes ?? []).map((v) => [v.hot_take_id, v.vote_type as "flame" | "trash"])
      );
    }
  }

  const items: HotTakeItem[] = allTakes.map((t) => ({
    id: t.id,
    userId: t.user_id,
    username: profileMap[t.user_id]?.username ?? "",
    displayName: profileMap[t.user_id]?.displayName ?? "Unknown",
    avatarUrl: profileMap[t.user_id]?.avatarUrl ?? null,
    content: t.content,
    topicId: t.topic_id,
    topicTitle: topicMap[t.topic_id]?.title ?? "Unknown Topic",
    topicSlug: topicMap[t.topic_id]?.slug ?? "",
    subjectName: t.subject_id ? (subjectMap[t.subject_id] ?? null) : null,
    attributeName: t.attribute_id ? (attributeMap[t.attribute_id] ?? null) : null,
    flames: t.flames,
    trashes: t.trashes,
    createdAt: t.created_at,
    takeOfTheDay: t.take_of_the_day ?? false,
  }));

  // All topics for filter dropdown
  const { data: allTopics } = await supabase
    .from("topics")
    .select("id, title")
    .eq("status", "active")
    .order("title");

  return (
    <HotTakesClient
      initialItems={items}
      initialVotes={userVotes}
      topics={(allTopics ?? []).map((t) => ({ id: t.id, title: t.title }))}
      userId={user?.id ?? null}
    />
  );
}
