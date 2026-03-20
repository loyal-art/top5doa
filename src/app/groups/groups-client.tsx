"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type FollowedUser = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

type GroupMember = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

type Group = {
  id: string;
  name: string;
  created_at: string;
  members: GroupMember[];
};

export function GroupsClient({
  initialGroups,
  followedUsers,
  userId,
}: {
  initialGroups: Group[];
  followedUsers: FollowedUser[];
  userId: string;
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const supabase = createClient();

  function openCreate() {
    setEditingGroup(null);
    setGroupName("");
    setSelectedIds(new Set());
    setError(null);
    setModalOpen(true);
  }

  function openEdit(group: Group) {
    setEditingGroup(group);
    setGroupName(group.name);
    setSelectedIds(new Set(group.members.map((m) => m.user_id).filter((id) => id !== userId)));
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingGroup(null);
  }

  function toggleMember(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    const name = groupName.trim();
    if (!name) { setError("Group name is required."); return; }
    setSaving(true);
    setError(null);

    // All member IDs including the owner
    const memberIds = [userId, ...selectedIds];

    if (editingGroup) {
      // Update name
      const { error: updateErr } = await supabase
        .from("groups")
        .update({ name })
        .eq("id", editingGroup.id);
      if (updateErr) { setError("Failed to update group."); setSaving(false); return; }

      // Sync members: delete all, re-insert
      await supabase.from("group_members").delete().eq("group_id", editingGroup.id);
      if (memberIds.length > 0) {
        await supabase.from("group_members").insert(
          memberIds.map((uid) => ({ group_id: editingGroup.id, user_id: uid }))
        );
      }

      // Update local state
      const allFollowed = Object.fromEntries(followedUsers.map((u) => [u.id, u]));
      const members: GroupMember[] = memberIds
        .map((uid) => {
          if (uid === userId) return null; // we'll add owner info below
          const u = allFollowed[uid];
          return u ? { user_id: u.id, username: u.username, display_name: u.display_name, avatar_url: u.avatar_url } : null;
        })
        .filter((m): m is GroupMember => m !== null);
      // Add a placeholder for the owner — we don't have their profile data here but they're always a member
      setGroups((prev) =>
        prev.map((g) => g.id === editingGroup.id ? { ...g, name, members } : g)
      );
    } else {
      // Create group
      const { data: newGroup, error: insertErr } = await supabase
        .from("groups")
        .insert({ owner_id: userId, name })
        .select("id, name, created_at")
        .single();
      if (insertErr || !newGroup) { setError("Failed to create group."); setSaving(false); return; }

      // Insert members
      if (memberIds.length > 0) {
        await supabase.from("group_members").insert(
          memberIds.map((uid) => ({ group_id: newGroup.id, user_id: uid }))
        );
      }

      const allFollowed = Object.fromEntries(followedUsers.map((u) => [u.id, u]));
      const members: GroupMember[] = memberIds
        .filter((uid) => uid !== userId)
        .map((uid) => {
          const u = allFollowed[uid];
          return u ? { user_id: u.id, username: u.username, display_name: u.display_name, avatar_url: u.avatar_url } : null;
        })
        .filter((m): m is GroupMember => m !== null);

      setGroups((prev) => [{ id: newGroup.id, name: newGroup.name, created_at: newGroup.created_at, members }, ...prev]);
    }

    setSaving(false);
    closeModal();
  }

  async function handleDelete(groupId: string) {
    await supabase.from("groups").delete().eq("id", groupId);
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setDeleteConfirmId(null);
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-4xl sm:text-5xl tracking-wide">FRIEND GROUPS</h1>
            <p className="text-neutral-500 font-body text-sm mt-1">
              Compare rankings with your crew.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="px-5 py-2.5 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold text-sm
                       hover:bg-brand-accent/90 transition-colors"
          >
            + Create Group
          </button>
        </div>

        {/* Groups list */}
        {groups.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-brand-border bg-brand-surface">
            <p className="font-display text-2xl text-neutral-600">NO GROUPS YET</p>
            <p className="text-sm text-neutral-600 mt-2 font-body">
              Create a group to compare rankings with friends.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div
                key={group.id}
                className="rounded-xl border border-brand-border bg-brand-surface p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-lg tracking-wide">{group.name.toUpperCase()}</h3>
                    <p className="text-xs font-mono text-neutral-600">
                      {group.members.length + 1} member{group.members.length !== 0 ? "s" : ""} (including you)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(group)}
                      className="px-3 py-1.5 rounded-lg text-xs font-mono text-neutral-400
                                 border border-brand-border hover:text-brand-accent hover:border-brand-accent/40 transition-colors"
                    >
                      Edit
                    </button>
                    {deleteConfirmId === group.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDelete(group.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-mono text-red-400
                                     border border-red-500/30 hover:bg-red-500/10 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-3 py-1.5 rounded-lg text-xs font-mono text-neutral-500
                                     border border-brand-border hover:text-neutral-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(group.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-mono text-neutral-500
                                   border border-brand-border hover:text-red-400 hover:border-red-500/30 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Member avatars */}
                {group.members.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {group.members.slice(0, 8).map((m) => (
                      <Link
                        key={m.user_id}
                        href={`/profile/${m.username}`}
                        className="group/avatar"
                        title={`@${m.username}`}
                      >
                        {m.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.avatar_url}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover border border-brand-border
                                       group-hover/avatar:border-brand-accent transition-colors"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-brand-accent/10 border border-brand-border
                                          flex items-center justify-center group-hover/avatar:border-brand-accent transition-colors">
                            <span className="font-display text-[10px] text-brand-accent">
                              {m.display_name.split(" ").map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase()}
                            </span>
                          </div>
                        )}
                      </Link>
                    ))}
                    {group.members.length > 8 && (
                      <span className="text-xs font-mono text-neutral-600">
                        +{group.members.length - 8}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ──────────────────────────────────── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-bg p-6 space-y-4 max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between flex-shrink-0">
              <h2 className="font-display text-2xl tracking-wide">
                {editingGroup ? "EDIT GROUP" : "CREATE GROUP"}
              </h2>
              <button
                onClick={closeModal}
                className="text-neutral-500 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Group name */}
            <div className="flex-shrink-0">
              <label className="text-xs font-mono text-neutral-500 uppercase tracking-wider block mb-1.5">
                Group Name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Music Heads, College Friends"
                className="w-full px-4 py-2.5 rounded-xl bg-brand-surface border border-brand-border text-white font-body text-sm
                           placeholder-neutral-600 focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/30 transition-colors"
                autoFocus
              />
            </div>

            {/* Members from follows list */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <label className="text-xs font-mono text-neutral-500 uppercase tracking-wider block mb-1.5 flex-shrink-0">
                Select Members ({selectedIds.size} selected)
              </label>
              {followedUsers.length === 0 ? (
                <p className="text-sm font-mono text-neutral-600 py-4">
                  You&apos;re not following anyone yet. Follow users to add them to groups.
                </p>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                  {followedUsers.map((u) => {
                    const isSelected = selectedIds.has(u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => toggleMember(u.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                          isSelected
                            ? "bg-brand-accent/10 border border-brand-accent/30"
                            : "border border-transparent hover:bg-white/5"
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
                            isSelected
                              ? "bg-brand-accent border-brand-accent text-brand-bg"
                              : "border-neutral-600"
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        {u.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-brand-accent/10 flex items-center justify-center flex-shrink-0">
                            <span className="font-display text-[10px] text-brand-accent">
                              {u.display_name.split(" ").map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-body text-neutral-200 truncate">{u.display_name}</p>
                          <p className="text-xs font-mono text-neutral-600">@{u.username}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm font-mono text-red-400 flex-shrink-0">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold text-sm
                           hover:bg-brand-accent/90 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : editingGroup ? "Save Changes" : "Create Group"}
              </button>
              <button
                onClick={closeModal}
                className="px-5 py-2.5 rounded-xl border border-brand-border text-neutral-400 font-mono text-sm
                           hover:text-white hover:border-neutral-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
