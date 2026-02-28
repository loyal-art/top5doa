"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import type { VotedTopic } from "./page";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

// ── Aura tier — mirrors the get_aura_tier() SQL function ───────────────────
function getAuraTier(points: number): { label: string; classes: string } {
  if (points >= 9500)
    return { label: "Legendary", classes: "text-amber-400 bg-amber-400/10 border-amber-400/30" };
  if (points >= 5000)
    return { label: "Elite", classes: "text-purple-400 bg-purple-400/10 border-purple-400/30" };
  if (points >= 2500)
    return { label: "Respected", classes: "text-blue-400 bg-blue-400/10 border-blue-400/30" };
  if (points >= 1000)
    return { label: "Known", classes: "text-brand-accent bg-brand-accent/10 border-brand-accent/30" };
  if (points >= 250)
    return { label: "Cold", classes: "text-neutral-400 bg-neutral-400/10 border-neutral-400/30" };
  return { label: "Ghost", classes: "text-neutral-600 bg-neutral-700/30 border-neutral-700" };
}

interface ProfileClientProps {
  profile: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
    tier: "free" | "premium";
    aura_points: number;
    is_public: boolean;
  };
  followerCount: number;
  isOwn: boolean;
  isFollowing: boolean;
  canSeeFullProfile: boolean;
  viewerId: string | null;
  votedTopics: VotedTopic[];
}

export function ProfileClient({
  profile,
  followerCount,
  isOwn,
  isFollowing: initialIsFollowing,
  canSeeFullProfile: initialCanSeeFullProfile,
  viewerId,
  votedTopics,
}: ProfileClientProps) {
  const supabase = createClient();
  const router = useRouter();

  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isPublic, setIsPublic] = useState(profile.is_public);
  const [followCount, setFollowCount] = useState(followerCount);
  const [followLoading, setFollowLoading] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(false);

  // Username editing (own profile only)
  const [currentUsername, setCurrentUsername] = useState(profile.username);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState(profile.username);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSaving, setUsernameSaving] = useState(false);

  // Recompute visibility live so the toggle instantly reveals/hides topics
  // on the owner's own view.
  const canSeeFullProfile = isPublic || isOwn || isFollowing;

  const tier = getAuraTier(profile.aura_points);

  // Two-letter initials for the avatar placeholder
  const initials = profile.display_name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  // ── Follow / unfollow ────────────────────────────────────────────────────
  async function handleFollow() {
    if (!viewerId) return;
    setFollowLoading(true);
    if (isFollowing) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", viewerId)
        .eq("following_id", profile.id);
      setIsFollowing(false);
      setFollowCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from("follows").insert({
        follower_id: viewerId,
        following_id: profile.id,
      });
      setIsFollowing(true);
      setFollowCount((c) => c + 1);
    }
    setFollowLoading(false);
  }

  // ── Privacy toggle ───────────────────────────────────────────────────────
  async function handlePrivacyToggle() {
    setPrivacyLoading(true);
    const next = !isPublic;
    const { error } = await supabase
      .from("profiles")
      .update({ is_public: next })
      .eq("id", profile.id);
    if (!error) setIsPublic(next);
    setPrivacyLoading(false);
  }

  // ── Username edit ────────────────────────────────────────────────────────
  function openUsernameEdit() {
    setUsernameInput(currentUsername);
    setUsernameError(null);
    setEditingUsername(true);
  }

  function cancelUsernameEdit() {
    setEditingUsername(false);
    setUsernameError(null);
  }

  async function handleUsernameSave() {
    const trimmed = usernameInput.trim();
    if (!USERNAME_RE.test(trimmed)) {
      setUsernameError("3–20 chars: lowercase letters, numbers, underscores only");
      return;
    }
    if (trimmed === currentUsername) {
      setEditingUsername(false);
      return;
    }
    setUsernameSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username: trimmed })
      .eq("id", profile.id);
    setUsernameSaving(false);
    if (error) {
      setUsernameError(
        error.code === "23505" ? "That username is already taken" : "Failed to save. Try again."
      );
      return;
    }
    setCurrentUsername(trimmed);
    setEditingUsername(false);
    // Tell the header to update its displayed username without a full reload
    window.dispatchEvent(
      new CustomEvent("profile-username-updated", { detail: { username: trimmed } })
    );
    // Navigate to the new URL slug
    router.push(`/profile/${trimmed}`);
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">

        {/* ── Profile header card ─────────────────────────────────────── */}
        <div className="p-6 rounded-2xl bg-brand-surface border border-brand-border space-y-5">

          {/* Top row: avatar · identity · action button */}
          <div className="flex items-start gap-5">

            {/* Avatar placeholder — shows initials */}
            <div
              className="w-20 h-20 rounded-full flex-shrink-0 flex items-center justify-center
                         bg-brand-accent/10 border-2 border-brand-accent/30"
            >
              <span className="font-display text-2xl text-brand-accent">{initials}</span>
            </div>

            {/* Name + @username + badges */}
            <div className="flex-1 min-w-0 pt-1">
              <h1 className="font-display text-3xl tracking-wide truncate">
                {profile.display_name.toUpperCase()}
              </h1>
              {/* @username — editable when viewing own profile */}
              {isOwn ? (
                <div className="mt-0.5">
                  {editingUsername ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-neutral-500 font-mono text-sm">@</span>
                      <input
                        value={usernameInput}
                        onChange={(e) => {
                          setUsernameInput(e.target.value.toLowerCase());
                          setUsernameError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUsernameSave();
                          if (e.key === "Escape") cancelUsernameEdit();
                        }}
                        maxLength={20}
                        autoFocus
                        className="font-mono text-sm bg-brand-surface border border-brand-border
                                   rounded px-2 py-0.5 text-white focus:outline-none
                                   focus:border-brand-accent w-36"
                      />
                      <button
                        onClick={handleUsernameSave}
                        disabled={usernameSaving}
                        className="text-xs font-mono px-2.5 py-1 rounded bg-brand-accent
                                   text-brand-bg font-bold hover:bg-brand-accent/90
                                   transition-colors disabled:opacity-50"
                      >
                        {usernameSaving ? "…" : "Save"}
                      </button>
                      <button
                        onClick={cancelUsernameEdit}
                        className="text-xs font-mono text-neutral-500 hover:text-neutral-300
                                   transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={openUsernameEdit}
                      className="flex items-center gap-1.5 group"
                    >
                      <span className="text-neutral-500 font-mono text-sm">
                        @{currentUsername}
                      </span>
                      {/* pencil icon */}
                      <svg
                        className="w-3 h-3 text-neutral-700 group-hover:text-brand-accent
                                   transition-colors flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582
                             16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0
                             011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                        />
                      </svg>
                    </button>
                  )}
                  {usernameError && (
                    <p className="text-red-400 font-mono text-xs mt-1">{usernameError}</p>
                  )}
                </div>
              ) : (
                <p className="text-neutral-500 font-mono text-sm mt-0.5">@{profile.username}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono
                               font-bold border ${tier.classes}`}
                >
                  {tier.label.toUpperCase()}
                </span>
                {profile.tier === "premium" && (
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono
                               font-bold border text-brand-accent bg-brand-accent/10 border-brand-accent/30"
                  >
                    PREMIUM
                  </span>
                )}
              </div>
            </div>

            {/* Action: privacy toggle (own) · follow button (other) · sign-in link (anon) */}
            <div className="flex-shrink-0 pt-1">
              {isOwn ? (
                <button
                  onClick={handlePrivacyToggle}
                  disabled={privacyLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-sm border
                               transition-all disabled:opacity-50
                               ${isPublic
                      ? "bg-brand-surface border-brand-border text-neutral-400 hover:border-neutral-500"
                      : "bg-brand-accent/10 border-brand-accent/40 text-brand-accent"
                    }`}
                >
                  {/* Eye / lock icon */}
                  <svg
                    className="w-3.5 h-3.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    {isPublic ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0
                           8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5
                           12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0
                           002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0
                           00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                      />
                    )}
                    {isPublic && (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    )}
                  </svg>
                  {isPublic ? "Public" : "Private"}
                </button>
              ) : viewerId ? (
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`px-5 py-2 rounded-xl font-mono font-bold text-sm border transition-all
                               disabled:opacity-50
                               ${isFollowing
                      ? "bg-brand-surface border-brand-border text-neutral-400 hover:border-red-500/50 hover:text-red-400"
                      : "bg-brand-accent text-brand-bg border-transparent hover:bg-brand-accent/90"
                    }`}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
              ) : (
                <a
                  href="/login"
                  className="px-5 py-2 rounded-xl font-mono font-bold text-sm
                             bg-brand-accent text-brand-bg hover:bg-brand-accent/90 transition-colors"
                >
                  Follow
                </a>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-6 pt-4 border-t border-brand-border">
            <div className="text-center">
              <p className="font-display text-xl text-brand-accent">
                {profile.aura_points.toLocaleString()}
              </p>
              <p className="text-xs font-mono text-neutral-600 uppercase mt-0.5">Aura Pts</p>
            </div>
            <div className="w-px h-8 bg-brand-border" />
            <div className="text-center">
              <p className="font-display text-xl">{followCount}</p>
              <p className="text-xs font-mono text-neutral-600 uppercase mt-0.5">Followers</p>
            </div>
            {canSeeFullProfile && (
              <>
                <div className="w-px h-8 bg-brand-border" />
                <div className="text-center">
                  <p className="font-display text-xl">{votedTopics.length}</p>
                  <p className="text-xs font-mono text-neutral-600 uppercase mt-0.5">Topics Voted</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Private / restricted view ───────────────────────────────── */}
        {!canSeeFullProfile && (
          <div className="p-10 rounded-2xl bg-brand-surface border border-brand-border text-center space-y-3">
            <svg
              className="w-8 h-8 text-neutral-600 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0
                   002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0
                   00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
            <p className="font-display text-xl tracking-wide">THIS PROFILE IS PRIVATE</p>
            <p className="text-neutral-500 text-sm font-body">
              Follow {profile.display_name} to see their rankings.
            </p>
          </div>
        )}

        {/* ── Voted topics ────────────────────────────────────────────── */}
        {canSeeFullProfile && (
          <div className="space-y-3">
            <h2 className="font-display text-xl tracking-wide">VOTED ON</h2>
            {votedTopics.length === 0 ? (
              <p className="text-neutral-500 text-sm font-mono py-4">
                No votes locked in yet.
              </p>
            ) : (
              <div className="space-y-3">
                {votedTopics.map((t) => (
                  <Link
                    key={t.topic_id}
                    href={`/topics/${t.topic_slug}`}
                    className="flex items-center gap-4 p-4 rounded-xl bg-brand-surface border
                               border-brand-border hover:border-brand-accent/40 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs text-neutral-500 uppercase tracking-wider">
                        {t.topic_title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center
                                     bg-brand-accent/20 text-brand-accent font-display text-xs"
                        >
                          1
                        </span>
                        <p className="font-display text-base tracking-wide truncate text-brand-accent">
                          {t.top_pick_name.toUpperCase()}
                        </p>
                        {t.top_pick_era && (
                          <p className="text-xs font-mono text-neutral-600 flex-shrink-0">
                            {t.top_pick_era}
                          </p>
                        )}
                      </div>
                    </div>
                    <svg
                      className="w-4 h-4 flex-shrink-0 text-neutral-600 group-hover:text-brand-accent transition-colors"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
