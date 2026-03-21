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

export type CreatedTopic = {
  id: string;
  title: string;
  slug: string;
  voter_count: number;
};

export type SavedPoster = {
  id: string;
  topic_id: string;
  topic_title: string;
  topic_slug: string;
  style: string;
  image_data: string;
  created_at: string;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const supabase = await createClient();

  // ── Profile lookup ──────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url, tier, aura_points, is_public, is_premium, daily_streak, streak_multiplier")
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

  // ── Category preferences (own profile only) ─────────────────────────────
  let savedCategories: string[] = [];
  if (isOwn) {
    const { data: prefRows } = await supabase
      .from("user_category_preferences")
      .select("category")
      .eq("user_id", profile.id);
    savedCategories = (prefRows ?? []).map((r) => r.category);
  }

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

  // ── Topics created by this user ──────────────────────────────────────────
  let createdTopics: CreatedTopic[] = [];
  if (canSeeFullProfile) {
    const { data: createdRows } = await supabase
      .from("topics")
      .select("id, title, slug")
      .eq("created_by", profile.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (createdRows && createdRows.length > 0) {
      // Get voter counts per topic
      const cTopicIds = createdRows.map((t) => t.id);
      const { data: voterRows } = await supabase
        .from("user_lists")
        .select("topic_id, user_id")
        .in("topic_id", cTopicIds);

      const voterCountMap: Record<string, Set<string>> = {};
      (voterRows ?? []).forEach((r) => {
        if (!voterCountMap[r.topic_id]) voterCountMap[r.topic_id] = new Set();
        voterCountMap[r.topic_id].add(r.user_id);
      });

      createdTopics = createdRows.map((t) => ({
        id: t.id,
        title: t.title,
        slug: t.slug,
        voter_count: voterCountMap[t.id]?.size ?? 0,
      }));
    }
  }

  // ── Saved posters ───────────────────────────────────────────────────────
  let savedPosters: SavedPoster[] = [];
  if (canSeeFullProfile) {
    const { data: posterRows } = await supabase
      .from("poster_images")
      .select("id, topic_id, style, image_data, created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });

    if (posterRows && posterRows.length > 0) {
      const posterTopicIds = posterRows.map((p) => p.topic_id);
      const { data: posterTopicRows } = await supabase
        .from("topics")
        .select("id, title, slug")
        .in("id", posterTopicIds);

      const posterTopicMap = Object.fromEntries(
        (posterTopicRows ?? []).map((t) => [t.id, t])
      );

      savedPosters = posterRows
        .filter((p) => posterTopicMap[p.topic_id])
        .map((p) => ({
          id: p.id,
          topic_id: p.topic_id,
          topic_title: posterTopicMap[p.topic_id].title,
          topic_slug: posterTopicMap[p.topic_id].slug,
          style: p.style,
          image_data: p.image_data,
          created_at: p.created_at,
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
      createdTopics={createdTopics}
      savedCategories={savedCategories}
      savedPosters={savedPosters}
    />
  );
}
