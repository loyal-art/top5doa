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
    // PostgREST infers the FK joins from user_lists → topics and → subjects.
    const { data: listRows } = await supabase
      .from("user_lists")
      .select("topic_id, topics(title, slug), subjects(name, era)")
      .eq("user_id", profile.id)
      .eq("rank_position", 1)
      .order("created_at", { ascending: false });

    if (listRows) {
      votedTopics = listRows
        .filter((r) => r.topics && r.subjects)
        .map((r) => {
          const topic = r.topics as { title: string; slug: string };
          const subject = r.subjects as { name: string; era: string | null };
          return {
            topic_id: r.topic_id,
            topic_title: topic.title,
            topic_slug: topic.slug,
            top_pick_name: subject.name,
            top_pick_era: subject.era,
          };
        });
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
