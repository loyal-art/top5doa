import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ProfileClient } from "./profile-client";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: ProfilePageProps) {
  const { username } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("username", username)
    .single();
  if (!profile) return { title: "Profile Not Found | Top5DOA" };
  return { title: `${profile.display_name} | Top5DOA` };
}

export type VotedTopic = {
  topic_id: string;
  topic_title: string;
  topic_slug: string;
  top_pick_name: string;
  top_pick_era: string | null;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const supabase = await createClient();

  // ── Profile lookup ──────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url, tier, aura_points, is_public")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  // ── Current viewer ──────────────────────────────────────────────────────
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  const viewerId = viewer?.id ?? null;
  const isOwn = viewerId === profile.id;

  // ── Follower count ──────────────────────────────────────────────────────
  const { count: followerCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", profile.id);

  // ── Is the viewer following this profile? ───────────────────────────────
  let isFollowing = false;
  if (viewerId && !isOwn) {
    const { data: followRow } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", viewerId)
      .eq("following_id", profile.id)
      .maybeSingle();
    isFollowing = !!followRow;
  }

  // ── Visibility gate ─────────────────────────────────────────────────────
  // Full profile visible when: public, own profile, or an approved follower.
  const canSeeFullProfile = profile.is_public || isOwn || isFollowing;

  // ── Voted topics with #1 pick ────────────────────────────────────────────
  // user_lists RLS now permits reads for public profiles (anon) and followed
  // private profiles (authenticated viewer).  Still guarded here so we never
  // even attempt the query when the viewer lacks access.
  let votedTopics: VotedTopic[] = [];

  if (canSeeFullProfile) {
    // Fetch the user's #1 pick row per topic from user_lists.
    // Avoid PostgREST FK-join syntax (topics(...) / subjects(...)) because
    // database.ts declares Relationships:[] for all tables — the Supabase
    // TypeScript client cannot infer those joins and the build fails with
    // "could not find the relation between user_lists and topics".
    // Instead use three flat queries and combine in application code.
    const { data: listRows } = await supabase
      .from("user_lists")
      .select("topic_id, subject_id")
      .eq("user_id", profile.id)
      .eq("rank_position", 1)
      .order("created_at", { ascending: false });

    if (listRows && listRows.length > 0) {
      const topicIds   = listRows.map((r) => r.topic_id);
      const subjectIds = listRows.map((r) => r.subject_id);

      const [{ data: topicRows }, { data: subjectRows }] = await Promise.all([
        supabase.from("topics").select("id, title, slug").in("id", topicIds),
        supabase.from("subjects").select("id, name, era").in("id", subjectIds),
      ]);

      const topicMap   = Object.fromEntries((topicRows   ?? []).map((t) => [t.id, t]));
      const subjectMap = Object.fromEntries((subjectRows ?? []).map((s) => [s.id, s]));

      votedTopics = listRows
        .filter((r) => topicMap[r.topic_id] && subjectMap[r.subject_id])
        .map((r) => ({
          topic_id:      r.topic_id,
          topic_title:   topicMap[r.topic_id].title,
          topic_slug:    topicMap[r.topic_id].slug,
          top_pick_name: subjectMap[r.subject_id].name,
          top_pick_era:  subjectMap[r.subject_id].era,
        }));
    }
  }

  return (
    <ProfileClient
      profile={profile}
      followerCount={followerCount ?? 0}
      isOwn={isOwn}
      isFollowing={isFollowing}
      canSeeFullProfile={canSeeFullProfile}
      viewerId={viewerId}
      votedTopics={votedTopics}
    />
  );
}
