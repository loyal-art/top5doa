import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FeedClient } from "./feed-client";

export type FeedItem = {
  listId: string;
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  topicId: string;
  topicTitle: string;
  topicSlug: string;
  votedAt: string;
  top3: { rank: number; name: string }[];
};

export default async function FeedPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Get followed user IDs
  const { data: followRows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id);

  const followedIds = (followRows ?? []).map((r) => r.following_id);

  if (followedIds.length === 0) {
    return <FeedClient items={[]} hasMore={false} followedIds={[]} userId={user.id} />;
  }

  // Get the most recent locked lists from followed users
  // user_lists has one row per ranked subject — group by (user_id, topic_id)
  // We need distinct (user_id, topic_id) combos sorted by most recent updated_at
  const { data: listRows } = await supabase
    .from("user_lists")
    .select("id, user_id, topic_id, subject_id, rank_position, updated_at")
    .in("user_id", followedIds)
    .order("updated_at", { ascending: false })
    .limit(200);

  const allRows = listRows ?? [];

  // Group by user_id + topic_id to form "lists"
  const listMap = new Map<string, typeof allRows>();
  for (const row of allRows) {
    const key = `${row.user_id}::${row.topic_id}`;
    if (!listMap.has(key)) listMap.set(key, []);
    listMap.get(key)!.push(row);
  }

  // Sort by most recent updated_at in each group
  const groupedLists = [...listMap.entries()]
    .map(([key, rows]) => {
      const [userId, topicId] = key.split("::");
      const mostRecent = rows.reduce((a, b) =>
        new Date(a.updated_at) > new Date(b.updated_at) ? a : b
      );
      return {
        userId,
        topicId,
        updatedAt: mostRecent.updated_at,
        rows: rows.sort((a, b) => a.rank_position - b.rank_position),
      };
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // Only show first page worth + 1 to know if there's more
  const PAGE_SIZE = 10;
  const firstPage = groupedLists.slice(0, PAGE_SIZE + 1);
  const hasMore = firstPage.length > PAGE_SIZE;
  const displayLists = firstPage.slice(0, PAGE_SIZE);

  // Collect unique user IDs, topic IDs, subject IDs
  const userIds = [...new Set(displayLists.map((l) => l.userId))];
  const topicIds = [...new Set(displayLists.map((l) => l.topicId))];
  const subjectIds = [...new Set(displayLists.flatMap((l) => l.rows.map((r) => r.subject_id)))];

  // Parallel fetches
  const [profilesRes, topicsRes, subjectsRes] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", userIds),
    supabase.from("topics").select("id, title, slug").in("id", topicIds),
    supabase.from("subjects").select("id, name").in("id", subjectIds),
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

  const items: FeedItem[] = displayLists.map((l) => ({
    listId: `${l.userId}-${l.topicId}`,
    userId: l.userId,
    displayName: profileMap[l.userId]?.displayName ?? "Unknown",
    username: profileMap[l.userId]?.username ?? "",
    avatarUrl: profileMap[l.userId]?.avatarUrl ?? null,
    topicId: l.topicId,
    topicTitle: topicMap[l.topicId]?.title ?? "Unknown Topic",
    topicSlug: topicMap[l.topicId]?.slug ?? "",
    votedAt: l.updatedAt,
    top3: l.rows.slice(0, 3).map((r) => ({
      rank: r.rank_position,
      name: subjectMap[r.subject_id] ?? "—",
    })),
  }));

  return <FeedClient items={items} hasMore={hasMore} followedIds={followedIds} userId={user.id} />;
}
