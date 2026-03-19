"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { awardAura } from "@/lib/aura";
import type { HotTakeItem } from "./page";

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function getViralBadge(flames: number): { label: string; className: string } | null {
  if (flames >= 100) return { label: "🔥🔥🔥 INFERNO", className: "text-red-400 bg-red-500/10 border-red-500/30" };
  if (flames >= 50)  return { label: "🔥🔥 BLAZING",  className: "text-orange-400 bg-orange-500/10 border-orange-500/30" };
  if (flames >= 10)  return { label: "🔥 VIRAL",      className: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" };
  return null;
}

function TakeCard({
  item,
  vote,
  userId,
  onVote,
}: {
  item: HotTakeItem;
  vote: "flame" | "trash" | null;
  userId: string | null;
  onVote: (takeId: string, voteType: "flame" | "trash") => void;
}) {
  const initials = item.displayName
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  const viralBadge = getViralBadge(item.flames);

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-surface p-5 space-y-3">
      {/* Take of the Day + viral badges */}
      {(item.takeOfTheDay || viralBadge) && (
        <div className="flex flex-wrap items-center gap-2">
          {item.takeOfTheDay && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-yellow-500/10 text-yellow-300 border border-yellow-500/30">
              🏆 TAKE OF THE DAY
            </span>
          )}
          {viralBadge && (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${viralBadge.className}`}>
              {viralBadge.label}
            </span>
          )}
        </div>
      )}

      {/* Header: avatar + user + timestamp */}
      <div className="flex items-center gap-3">
        <Link
          href={`/profile/${item.username}`}
          className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-brand-accent/10 border border-brand-accent/30 hover:border-brand-accent transition-colors overflow-hidden"
        >
          {item.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <span className="font-display text-sm text-brand-accent">{initials}</span>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            href={`/profile/${item.username}`}
            className="font-display text-sm tracking-wide text-white hover:text-brand-accent transition-colors"
          >
            @{item.username}
          </Link>
          <p className="text-xs font-mono text-neutral-600">
            {relativeTime(item.createdAt)}
          </p>
        </div>
      </div>

      {/* Take content */}
      <p className="text-sm font-body text-neutral-200 leading-relaxed">{item.content}</p>

      {/* Context: topic + subject/attribute */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/topics/${item.topicSlug}`}
          className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-brand-accent/10 text-brand-accent border border-brand-accent/20 hover:bg-brand-accent/20 transition-colors"
        >
          {item.topicTitle}
        </Link>
        {item.subjectName && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            {item.subjectName}
          </span>
        )}
        {item.attributeName && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            {item.attributeName}
          </span>
        )}
      </div>

      {/* Flame / Trash buttons */}
      <div className="flex items-center gap-4 pt-1">
        <button
          onClick={() => userId && onVote(item.id, "flame")}
          disabled={!userId}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono transition-colors ${
            vote === "flame"
              ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
              : "bg-brand-bg border border-brand-border text-neutral-500 hover:text-orange-400 hover:border-orange-500/30"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <span>🔥</span>
          <span>{item.flames}</span>
        </button>
        <button
          onClick={() => userId && onVote(item.id, "trash")}
          disabled={!userId}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono transition-colors ${
            vote === "trash"
              ? "bg-neutral-500/20 text-neutral-300 border border-neutral-500/40"
              : "bg-brand-bg border border-brand-border text-neutral-500 hover:text-neutral-300 hover:border-neutral-500/30"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <span>🗑️</span>
          <span>{item.trashes}</span>
        </button>
      </div>
    </div>
  );
}

export function HotTakesClient({
  initialItems,
  initialVotes,
  topics,
  userId,
}: {
  initialItems: HotTakeItem[];
  initialVotes: Record<string, "flame" | "trash">;
  topics: { id: string; title: string }[];
  userId: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [votes, setVotes] = useState(initialVotes);
  const [filterTopicId, setFilterTopicId] = useState<string>("all");
  const supabase = createClient();

  const filteredItems = filterTopicId === "all"
    ? items
    : items.filter((i) => i.topicId === filterTopicId);

  async function handleVote(takeId: string, voteType: "flame" | "trash") {
    if (!userId) return;
    const currentVote = votes[takeId] ?? null;

    // Optimistic update
    const updatedItems = items.map((item) => {
      if (item.id !== takeId) return item;
      let { flames, trashes } = item;

      if (currentVote === voteType) {
        // Toggle off
        if (voteType === "flame") flames--;
        else trashes--;
      } else {
        // Remove previous vote if switching
        if (currentVote === "flame") flames--;
        else if (currentVote === "trash") trashes--;
        // Add new vote
        if (voteType === "flame") flames++;
        else trashes++;
      }

      return { ...item, flames, trashes };
    });

    const newVotes = { ...votes };
    if (currentVote === voteType) {
      delete newVotes[takeId];
    } else {
      newVotes[takeId] = voteType;
    }

    setItems(updatedItems);
    setVotes(newVotes);

    // Persist to database
    if (currentVote === voteType) {
      // Remove vote
      await supabase
        .from("hot_take_votes")
        .delete()
        .eq("hot_take_id", takeId)
        .eq("user_id", userId);
      // Decrement counter
      const col = voteType === "flame" ? "flames" : "trashes";
      const take = items.find((i) => i.id === takeId);
      if (take) {
        await supabase
          .from("hot_takes")
          .update({ [col]: Math.max(0, take[col] - 1) })
          .eq("id", takeId);
      }
    } else {
      if (currentVote) {
        // Switch: remove old vote first
        await supabase
          .from("hot_take_votes")
          .delete()
          .eq("hot_take_id", takeId)
          .eq("user_id", userId);
        // Decrement old counter
        const oldCol = currentVote === "flame" ? "flames" : "trashes";
        const take = items.find((i) => i.id === takeId);
        if (take) {
          await supabase
            .from("hot_takes")
            .update({ [oldCol]: Math.max(0, take[oldCol] - 1) })
            .eq("id", takeId);
        }
      }
      // Insert new vote
      await supabase
        .from("hot_take_votes")
        .insert({ hot_take_id: takeId, user_id: userId, vote_type: voteType });
      // Increment new counter
      const newCol = voteType === "flame" ? "flames" : "trashes";
      const updatedTake = updatedItems.find((i) => i.id === takeId);
      if (updatedTake) {
        await supabase
          .from("hot_takes")
          .update({ [newCol]: updatedTake[newCol] })
          .eq("id", takeId);
      }

      // ── Post-flame bonuses ─────────────────────────────────────────────
      if (voteType === "flame" && updatedTake) {
        const newFlameCount = updatedTake.flames;

        // Award +2 aura to the take owner
        await awardAura(supabase, updatedTake.userId, "flame", takeId);

        // Viral milestone bonuses (10 / 50 / 100 flames)
        await supabase.rpc("check_viral_milestones", {
          p_hot_take_id: takeId,
          p_user_id:     updatedTake.userId,
          p_flame_count: newFlameCount,
        });

        // Hot streak: increment at exactly 10 flames
        if (newFlameCount === 10) {
          await supabase.rpc("check_hot_streak", { p_user_id: updatedTake.userId });
        }
      }
    }
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl tracking-wide">HOT TAKES</h1>
          <p className="text-neutral-500 font-body text-sm mt-1">
            Spicy opinions from the community.
          </p>
        </div>

        {/* Topic filter */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-mono text-neutral-500 uppercase tracking-wider">Filter:</label>
          <select
            value={filterTopicId}
            onChange={(e) => setFilterTopicId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-brand-surface border border-brand-border text-sm font-mono text-neutral-300 focus:outline-none focus:border-brand-accent"
          >
            <option value="all">All Topics</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>

        {/* Takes list */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-brand-border bg-brand-surface">
            <p className="font-display text-2xl text-neutral-600">NO HOT TAKES YET</p>
            <p className="text-sm text-neutral-600 mt-2 font-body">
              Be the first to drop a spicy take while voting on a topic.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <TakeCard
                key={item.id}
                item={item}
                vote={votes[item.id] ?? null}
                userId={userId}
                onVote={handleVote}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
