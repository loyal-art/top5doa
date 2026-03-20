import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GroupsClient } from "./groups-client";

export const metadata = {
  title: "Friend Groups | Top5DOA",
  description: "Create and manage friend groups to compare rankings.",
};

type FollowedUser = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

type GroupRow = {
  id: string;
  name: string;
  created_at: string;
  members: { user_id: string; username: string; display_name: string; avatar_url: string | null }[];
};

export default async function GroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch groups owned by the user
  const { data: groups } = await supabase
    .from("groups")
    .select("id, name, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  // Fetch members for all groups
  const groupIds = (groups ?? []).map((g) => g.id);
  let membersByGroup: Record<string, { user_id: string; username: string; display_name: string; avatar_url: string | null }[]> = {};
  if (groupIds.length > 0) {
    const { data: memberRows } = await supabase
      .from("group_members")
      .select("group_id, user_id")
      .in("group_id", groupIds);
    const memberUserIds = [...new Set((memberRows ?? []).map((m) => m.user_id))];
    let profileMap: Record<string, { username: string; display_name: string; avatar_url: string | null }> = {};
    if (memberUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", memberUserIds);
      profileMap = Object.fromEntries(
        (profiles ?? []).map((p) => [p.id, { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url }])
      );
    }
    for (const m of memberRows ?? []) {
      if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = [];
      const p = profileMap[m.user_id];
      if (p) {
        membersByGroup[m.group_id].push({ user_id: m.user_id, ...p });
      }
    }
  }

  const groupRows: GroupRow[] = (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    created_at: g.created_at,
    members: membersByGroup[g.id] ?? [],
  }));

  // Fetch users the current user follows
  const { data: followRows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id);
  const followedIds = (followRows ?? []).map((r) => r.following_id);

  let followedUsers: FollowedUser[] = [];
  if (followedIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", followedIds)
      .order("username");
    followedUsers = (profiles ?? []).map((p) => ({
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
    }));
  }

  return (
    <GroupsClient
      initialGroups={groupRows}
      followedUsers={followedUsers}
      userId={user.id}
    />
  );
}
