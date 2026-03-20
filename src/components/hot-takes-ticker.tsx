"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type TickerTake = {
  id: string;
  content: string;
  flames: number;
  trashes: number;
  username: string;
  topic_title: string;
  topic_slug: string;
  subject_name: string | null;
  attribute_name: string | null;
};

/** Build the ticker array with flame-weighted duplication for seamless loop. */
function buildTickerItems(takes: TickerTake[]): TickerTake[] {
  const weighted: TickerTake[] = [];
  for (const take of takes) {
    weighted.push(take); // always include once
    if (take.flames >= 5) weighted.push(take);
    if (take.flames >= 10) weighted.push(take);
    if (take.flames >= 50) weighted.push(take);
  }
  // Duplicate the whole set for seamless CSS scroll loop
  return [...weighted, ...weighted];
}

export function HotTakesTicker({
  takes: initialTakes,
  userId,
}: {
  takes: TickerTake[];
  userId: string | null;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [takes, setTakes] = useState(initialTakes);
  const [pipTakeId, setPipTakeId] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, "flame" | "trash">>({});
  const supabase = createClient();

  if (dismissed || takes.length === 0) return null;

  const items = buildTickerItems(takes);
  // Base count before duplication (for animation timing)
  const baseCount = takes.length + takes.filter((t) => t.flames >= 5).length
    + takes.filter((t) => t.flames >= 10).length
    + takes.filter((t) => t.flames >= 50).length;

  const pipTake = pipTakeId ? takes.find((t) => t.id === pipTakeId) ?? null : null;

  async function handleVote(takeId: string, voteType: "flame" | "trash") {
    if (!userId) return;
    const currentVote = votes[takeId] ?? null;
    const preTakes = takes;

    // Optimistic update
    const updatedTakes = takes.map((t) => {
      if (t.id !== takeId) return t;
      let { flames, trashes } = t;
      if (currentVote === voteType) {
        if (voteType === "flame") flames--; else trashes--;
      } else {
        if (currentVote === "flame") flames--;
        else if (currentVote === "trash") trashes--;
        if (voteType === "flame") flames++; else trashes++;
      }
      return { ...t, flames: Math.max(0, flames), trashes: Math.max(0, trashes) };
    });

    const newVotes = { ...votes };
    if (currentVote === voteType) {
      delete newVotes[takeId];
    } else {
      newVotes[takeId] = voteType;
    }

    setTakes(updatedTakes);
    setVotes(newVotes);

    // Persist
    if (currentVote === voteType) {
      await supabase.from("hot_take_votes").delete()
        .eq("hot_take_id", takeId).eq("user_id", userId);
      const col = voteType === "flame" ? "flames" : "trashes";
      const take = preTakes.find((t) => t.id === takeId);
      if (take) {
        await supabase.from("hot_takes")
          .update({ [col]: Math.max(0, take[col] - 1) }).eq("id", takeId);
      }
    } else {
      if (currentVote) {
        await supabase.from("hot_take_votes").delete()
          .eq("hot_take_id", takeId).eq("user_id", userId);
        const oldCol = currentVote === "flame" ? "flames" : "trashes";
        const take = preTakes.find((t) => t.id === takeId);
        if (take) {
          await supabase.from("hot_takes")
            .update({ [oldCol]: Math.max(0, take[oldCol] - 1) }).eq("id", takeId);
        }
      }
      await supabase.from("hot_take_votes")
        .insert({ hot_take_id: takeId, user_id: userId, vote_type: voteType });
      const newCol = voteType === "flame" ? "flames" : "trashes";
      const updatedTake = updatedTakes.find((t) => t.id === takeId);
      if (updatedTake) {
        await supabase.from("hot_takes")
          .update({ [newCol]: updatedTake[newCol] }).eq("id", takeId);
      }
    }
  }

  return (
    <>
      {/* ── Ticker bar ──────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 h-10 flex items-center"
        style={{ background: "#111", borderTop: "1px solid #e8ff00" }}
      >
        <div className="flex-1 overflow-hidden relative h-full">
          <div
            className="hot-takes-ticker flex items-center gap-10 h-full whitespace-nowrap absolute"
            style={{ animationDuration: `${baseCount * 12}s` }}
          >
            {items.map((take, i) => (
              <button
                key={`${take.id}-${i}`}
                onClick={() => setPipTakeId(take.id)}
                className="inline-flex items-center gap-1.5 text-sm font-mono shrink-0 hover:opacity-80 transition-opacity"
              >
                <span className="text-neutral-300">🔥</span>
                <span style={{ color: "#e8ff00" }}>@{take.username}:</span>
                <span className="text-neutral-300">
                  &ldquo;{take.content.length > 80
                    ? take.content.slice(0, 80) + "…"
                    : take.content}&rdquo;
                </span>
                <span className="text-neutral-500">—</span>
                <span className="text-neutral-400">{take.topic_title}</span>
                {take.flames > 0 && (
                  <span style={{ color: "#FF4500" }} className="font-bold">
                    🔥{take.flames}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 w-10 h-full flex items-center justify-center text-neutral-600 hover:text-neutral-300 transition-colors"
          style={{ background: "#111" }}
          aria-label="Dismiss ticker"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── PiP panel ───────────────────────────────────────────── */}
      {pipTake && (
        <div
          className="fixed z-[60] bottom-14 right-4 w-80 rounded-xl border border-brand-border
                     bg-brand-surface shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-brand-border">
            <span className="font-display text-xs tracking-[0.15em] text-neutral-500">
              HOT TAKE
            </span>
            <button
              onClick={() => setPipTakeId(null)}
              className="text-neutral-600 hover:text-neutral-300 transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-3 space-y-3">
            {/* Content */}
            <p className="text-sm font-body text-neutral-200 leading-relaxed whitespace-normal">
              &ldquo;{pipTake.content}&rdquo;
            </p>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono">
              <Link
                href={`/profile/${pipTake.username}`}
                style={{ color: "#e8ff00" }}
                className="hover:underline"
                onClick={() => setPipTakeId(null)}
              >
                @{pipTake.username}
              </Link>
              <span className="text-neutral-600">·</span>
              <Link
                href={`/topics/${pipTake.topic_slug}`}
                className="text-neutral-400 hover:text-white transition-colors"
                onClick={() => setPipTakeId(null)}
              >
                {pipTake.topic_title}
              </Link>
              {pipTake.subject_name && (
                <>
                  <span className="text-neutral-600">·</span>
                  <span className="text-neutral-500">{pipTake.subject_name}</span>
                </>
              )}
              {pipTake.attribute_name && (
                <>
                  <span className="text-neutral-600">·</span>
                  <span className="text-neutral-500">{pipTake.attribute_name}</span>
                </>
              )}
            </div>

            {/* Vote buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handleVote(pipTake.id, "flame")}
                disabled={!userId}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono transition-colors ${
                  votes[pipTake.id] === "flame"
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
                    : "bg-brand-bg border border-brand-border text-neutral-500 hover:text-orange-400 hover:border-orange-500/30"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <span>🔥</span>
                <span>{pipTake.flames}</span>
              </button>
              <button
                onClick={() => handleVote(pipTake.id, "trash")}
                disabled={!userId}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono transition-colors ${
                  votes[pipTake.id] === "trash"
                    ? "bg-neutral-500/20 text-neutral-300 border border-neutral-500/40"
                    : "bg-brand-bg border border-brand-border text-neutral-500 hover:text-neutral-300 hover:border-neutral-500/30"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <span>🗑️</span>
                <span>{pipTake.trashes}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
