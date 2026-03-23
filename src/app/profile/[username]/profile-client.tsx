"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import type { VotedTopic, CreatedTopic, SavedPoster, UserIdentity } from "./page";
import { getTierForAura, getGlowColor, getNextTier, getTierBadgeClasses, awardAura, TIERS } from "@/lib/aura";
import { containsProfanity, PROFANITY_MESSAGE } from "@/lib/profanity";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

const ALERT_CATEGORIES = [
  "Music", "Sports", "Fashion", "Film",
  "TV", "Food", "Gaming", "Culture",
] as const;

interface ProfileClientProps {
  profile: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
    tier: string;
    aura_points: number;
    is_public: boolean;
    is_premium: boolean;
    daily_streak: number;
    streak_multiplier: number;
  };
  followerCount: number;
  isOwn: boolean;
  isFollowing: boolean;
  canSeeFullProfile: boolean;
  viewerId: string | null;
  votedTopics: VotedTopic[];
  createdTopics: CreatedTopic[];
  savedCategories: string[];
  savedPosters: SavedPoster[];
  userIdentities: UserIdentity[];
}

export function ProfileClient({
  profile,
  followerCount,
  isOwn,
  isFollowing: initialIsFollowing,
  canSeeFullProfile: initialCanSeeFullProfile,
  viewerId,
  votedTopics,
  createdTopics,
  savedCategories,
  savedPosters,
  userIdentities,
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

  // Category alert preferences (own premium profile only)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(savedCategories)
  );
  const [categoryLoading, setCategoryLoading] = useState<string | null>(null);

  // Poster overlay
  const [viewingPoster, setViewingPoster] = useState<SavedPoster | null>(null);

  // Premium gate message for privacy toggle
  const [premiumGateMsg, setPremiumGateMsg] = useState(false);

  // Recompute visibility live so the toggle instantly reveals/hides topics
  // on the owner's own view.
  const canSeeFullProfile = isPublic || isOwn || isFollowing;

  const tierName = getTierForAura(profile.aura_points);
  const tierBadgeClasses = getTierBadgeClasses(tierName);
  const glowColor = getGlowColor(tierName);
  const nextTier = getNextTier(profile.aura_points);
  // For Aura Beast (rainbow), use a CSS animation fallback color
  const avatarGlowStyle = glowColor === "rainbow"
    ? { boxShadow: "0 0 0 3px #e8ff00, 0 0 12px 4px rgba(232,255,0,0.4)" }
    : { boxShadow: `0 0 0 3px ${glowColor}, 0 0 12px 4px ${glowColor}40` };

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
      const { error } = await supabase.from("follows").insert({
        follower_id: viewerId,
        following_id: profile.id,
      });
      if (!error) {
        // Fetch follower's display name and insert a notification
        const { data: follower } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", viewerId)
          .single();
        if (follower) {
          await supabase.from("notifications").insert({
            user_id: profile.id,
            type: "follow",
            title: "New Follower",
            message: `${follower.display_name} started following you`,
          });
        }
        // Award aura: follower gets +1, followed user gets +10
        await awardAura(supabase, viewerId, "follow", profile.id);
        await awardAura(supabase, profile.id, "receive_follow", viewerId);
      }
      setIsFollowing(true);
      setFollowCount((c) => c + 1);
    }
    setFollowLoading(false);
  }

  // ── Privacy toggle ───────────────────────────────────────────────────────
  async function handlePrivacyToggle() {
    // Non-premium users cannot change privacy setting
    if (!profile.is_premium) {
      setPremiumGateMsg(true);
      setTimeout(() => setPremiumGateMsg(false), 4000);
      return;
    }
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
    if (containsProfanity(trimmed)) {
      setUsernameError(PROFANITY_MESSAGE);
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

  // ── Category alert preference toggle ─────────────────────────────────────
  async function handleCategoryToggle(cat: string) {
    if (categoryLoading) return;
    setCategoryLoading(cat);
    const isActive = selectedCategories.has(cat);
    if (isActive) {
      const { error } = await supabase
        .from("user_category_preferences")
        .delete()
        .eq("user_id", profile.id)
        .eq("category", cat);
      if (!error) {
        setSelectedCategories((prev) => {
          const next = new Set(prev);
          next.delete(cat);
          return next;
        });
      }
    } else {
      const { error } = await supabase
        .from("user_category_preferences")
        .insert({ user_id: profile.id, category: cat });
      if (!error) {
        setSelectedCategories((prev) => new Set([...prev, cat]));
      }
    }
    setCategoryLoading(null);
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">

        {/* ── Profile header card ─────────────────────────────────────── */}
        <div className="p-6 rounded-2xl bg-brand-surface border border-brand-border space-y-5">

          {/* Top row: avatar · identity · action button */}
          <div className="flex items-start gap-5">

            {/* Avatar with tier glow ring */}
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                className="w-20 h-20 rounded-full object-cover flex-shrink-0"
                style={avatarGlowStyle}
              />
            ) : (
              <div
                className="w-20 h-20 rounded-full flex-shrink-0 flex items-center justify-center bg-brand-accent/10"
                style={avatarGlowStyle}
              >
                <span className="font-display text-2xl text-brand-accent">{initials}</span>
              </div>
            )}

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
                        className="w-3 h-3 text-neutral-700 group-hover:text-brand-accent transition-colors flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
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
                               font-bold border ${tierBadgeClasses}`}
                >
                  {tierName.toUpperCase()}
                </span>
                {profile.is_premium && (
                  <span
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono
                               font-bold border text-brand-accent bg-brand-accent/10 border-brand-accent/30"
                  >
                    PREMIUM
                  </span>
                )}
              </div>
              {/* Tier progression wedge */}
              {(() => {
                const currentTierColor = glowColor === "rainbow" ? "#FFD700" : glowColor;
                const currentTierObj = TIERS.find((t) => t.name === tierName);
                const currentMin = currentTierObj?.minPoints ?? 0;

                if (!nextTier) {
                  // Max tier — full golden wedge
                  return (
                    <div className="mt-3 w-full max-w-xs">
                      <div className="relative h-8">
                        <div
                          className="absolute inset-0"
                          style={{
                            clipPath: "polygon(0 35%, 100% 0, 100% 100%, 0 65%)",
                            background: "linear-gradient(to right, #FFD700, #FFA500, #FFD700)",
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-black" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          <span className="text-[11px] font-display font-bold text-black tracking-widest">
                            MAX TIER
                          </span>
                          <svg className="w-3.5 h-3.5 text-black" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  );
                }

                const tierRange = nextTier.auraNeeded - currentMin;
                const progress = tierRange > 0
                  ? Math.min(((profile.aura_points - currentMin) / tierRange) * 100, 100)
                  : 0;
                const nextTierColor = getGlowColor(nextTier.name);

                return (
                  <div className="mt-3 w-full max-w-xs">
                    {/* Tier labels */}
                    <div className="flex items-end justify-between mb-1">
                      <span
                        className="text-[10px] font-mono font-bold uppercase tracking-wider"
                        style={{ color: currentTierColor }}
                      >
                        {tierName}
                      </span>
                      <span
                        className="text-[10px] font-mono font-bold uppercase tracking-wider"
                        style={{ color: nextTierColor }}
                      >
                        {nextTier.name}
                      </span>
                    </div>
                    {/* Wedge bar */}
                    <div className="relative h-7">
                      {/* Track (empty wedge) */}
                      <div
                        className="absolute inset-0 opacity-20"
                        style={{
                          clipPath: "polygon(0 35%, 100% 0, 100% 100%, 0 65%)",
                          background: `linear-gradient(to right, ${currentTierColor}, ${nextTierColor})`,
                        }}
                      />
                      {/* Fill (progress wedge) */}
                      <div
                        className="absolute inset-0 transition-all duration-500"
                        style={{
                          clipPath: "polygon(0 35%, 100% 0, 100% 100%, 0 65%)",
                          background: `linear-gradient(to right, ${currentTierColor}, ${nextTierColor})`,
                          width: `${Math.max(progress, 2)}%`,
                        }}
                      />
                      {/* Progress text */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-mono font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                          {profile.aura_points.toLocaleString()} / {nextTier.auraNeeded.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {/* Remaining text */}
                    <p className="text-[10px] font-mono text-neutral-600 mt-1 text-center">
                      {nextTier.remaining.toLocaleString()} Aura to reach{" "}
                      <span style={{ color: nextTierColor }}>{nextTier.name}</span>
                    </p>
                  </div>
                );
              })()}
            </div>

            {/* Action: privacy toggle (own) · follow button (other) · sign-in link (anon) */}
            <div className="flex-shrink-0 pt-1">
              {isOwn ? (
                <div className="flex flex-col items-end gap-1.5">
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
                    {!profile.is_premium && (
                      <span className="text-[10px] opacity-60">🔒</span>
                    )}
                  </button>
                  {/* Premium gate message */}
                  {premiumGateMsg && (
                    <p className="text-xs font-mono text-brand-accent max-w-[220px] text-right leading-snug animate-pulse">
                      🔒 Private profiles are a Premium feature. Keep engaging to unlock!
                    </p>
                  )}
                  {/* Expired premium note: private but no longer premium */}
                  {!profile.is_premium && !isPublic && !premiumGateMsg && (
                    <p className="text-[10px] font-mono text-neutral-600 max-w-[220px] text-right leading-snug">
                      Your profile is private. Renew Premium to change this setting.
                    </p>
                  )}
                </div>
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
          <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-brand-border">
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
            {/* Streak — shown when the user has an active streak */}
            {profile.daily_streak > 0 && (
              <>
                <div className="w-px h-8 bg-brand-border" />
                <div className="text-center">
                  <p
                    className="font-display text-xl flame-glow"
                    style={{ color: "#FF4500" }}
                  >
                    🔥 {profile.daily_streak}
                  </p>
                  <p className="text-xs font-mono text-neutral-600 uppercase mt-0.5">Day Streak</p>
                </div>
              </>
            )}
            {/* Momentum multiplier — shown when streak is high enough to boost */}
            {profile.streak_multiplier > 1.0 && (
              <>
                <div className="w-px h-8 bg-brand-border" />
                <div className="text-center">
                  <p className="font-display text-xl" style={{ color: "#e8ff00" }}>
                    ⚡ x{parseFloat(profile.streak_multiplier.toFixed(2)).toString()}
                  </p>
                  <p className="text-xs font-mono text-neutral-600 uppercase mt-0.5">Momentum</p>
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
        {/* ── Your Identities ──────────────────────────────────────── */}
        {canSeeFullProfile && userIdentities.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-display text-xl tracking-wide">YOUR IDENTITIES</h2>
            <div className="space-y-3">
              {userIdentities.map((identity) => (
                <Link
                  key={identity.topic_id}
                  href={`/topics/${identity.topic_slug}`}
                  className="flex items-center gap-4 p-4 rounded-xl bg-brand-surface border
                             border-brand-border hover:border-amber-500/40 transition-colors group"
                >
                  <span className="text-3xl flex-shrink-0">{identity.archetype_icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-neutral-500 uppercase tracking-wider">
                      {identity.topic_title}
                    </p>
                    <p className="font-display text-base tracking-wide mt-1" style={{ color: "#FFD700" }}>
                      {identity.archetype_name.toUpperCase()}
                    </p>
                    {identity.secondary_name && (
                      <p className="text-xs font-mono mt-0.5" style={{ color: "#a78bfa" }}>
                        With a touch of {identity.secondary_name}
                      </p>
                    )}
                  </div>
                  <svg
                    className="w-4 h-4 flex-shrink-0 text-neutral-600 group-hover:text-amber-400 transition-colors"
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
          </div>
        )}

        {/* ── Saved posters ──────────────────────────────────────────── */}
        {canSeeFullProfile && savedPosters.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-display text-xl tracking-wide">MY POSTERS</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {savedPosters.map((poster) => (
                <button
                  key={poster.id}
                  onClick={() => setViewingPoster(poster)}
                  className="group relative rounded-xl overflow-hidden border border-brand-border
                             hover:border-purple-500/40 transition-colors aspect-square"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/png;base64,${poster.image_data}`}
                    alt={`Poster for ${poster.topic_title}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
                    <p className="font-mono text-xs text-white truncate">{poster.topic_title}</p>
                    <p className="font-mono text-[10px] text-neutral-400 uppercase">{poster.style}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Created topics ─────────────────────────────────────────── */}
        {canSeeFullProfile && (
          <div className="space-y-3">
            <h2 className="font-display text-xl tracking-wide">CREATED</h2>
            {createdTopics.length === 0 ? (
              <p className="text-neutral-500 text-sm font-mono py-4">
                No topics created yet.
              </p>
            ) : (
              <div className="space-y-3">
                {createdTopics.map((t) => (
                  <Link
                    key={t.id}
                    href={`/topics/${t.slug}`}
                    className="flex items-center gap-4 p-4 rounded-xl bg-brand-surface border
                               border-brand-border hover:border-brand-accent/40 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-base tracking-wide truncate text-white group-hover:text-brand-accent transition-colors">
                        {t.title.toUpperCase()}
                      </p>
                      <p className="text-xs font-mono text-neutral-600 mt-1">
                        {t.voter_count} {t.voter_count === 1 ? "voter" : "voters"}
                      </p>
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
        {/* ── Alert preferences (own premium profile only) ──────────── */}
        {isOwn && profile.is_premium && (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-xl tracking-wide">ALERT PREFERENCES</h2>
              <p className="text-neutral-500 text-sm font-mono mt-1">
                Get notified when new topics drop in your selected categories.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-brand-surface border border-brand-border">
              <div className="flex flex-wrap gap-2">
                {ALERT_CATEGORIES.map((cat) => {
                  const active = selectedCategories.has(cat);
                  const loading = categoryLoading === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => handleCategoryToggle(cat)}
                      disabled={!!categoryLoading}
                      className={`px-4 py-2 rounded-xl font-mono text-sm border transition-all
                                 disabled:opacity-60
                                 ${active
                                   ? "bg-brand-accent/15 border-brand-accent/50 text-brand-accent"
                                   : "bg-brand-bg border-brand-border text-neutral-500 hover:border-neutral-500 hover:text-neutral-300"
                                 }`}
                    >
                      {loading ? "…" : cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Poster viewer overlay */}
      {viewingPoster && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setViewingPoster(null); }}
        >
          <div className="relative w-full max-w-2xl flex flex-col items-center gap-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setViewingPoster(null)}
              className="absolute -top-2 -right-2 z-10 w-10 h-10 flex items-center justify-center rounded-full
                         bg-neutral-900 border border-neutral-700 text-neutral-400 hover:text-white transition-colors"
            >
              ✕
            </button>
            <div className="relative w-full rounded-xl overflow-hidden shadow-2xl shadow-purple-500/10 border border-neutral-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${viewingPoster.image_data}`}
                alt={`Poster for ${viewingPoster.topic_title}`}
                className="w-full h-auto"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const link = document.createElement("a");
                  link.download = `top5-poster-${viewingPoster.topic_slug}.png`;
                  link.href = `data:image/png;base64,${viewingPoster.image_data}`;
                  link.click();
                }}
                className="px-5 py-2.5 rounded-xl bg-brand-surface border border-brand-border
                           text-neutral-300 font-mono text-sm hover:border-neutral-600 transition-colors
                           flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
                </svg>
                Download
              </button>
              <Link
                href={`/topics/${viewingPoster.topic_slug}`}
                className="px-5 py-2.5 rounded-xl bg-brand-surface border border-brand-border
                           text-neutral-300 font-mono text-sm hover:border-neutral-600 transition-colors"
              >
                View Topic
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
