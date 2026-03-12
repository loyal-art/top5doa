"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { SuggestionRow } from "@/components/suggested-topics-panel";
import { brandHighlight } from "@/lib/utils";

const ALL_CATEGORIES = [
  "NFL", "NBA", "MLB", "Music", "Movies", "Gaming",
  "Combat", "Culture", "Sports", "Film", "Fashion", "TV", "Food",
] as const;

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function daysRemaining(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ── Vote toggle button ───────────────────────────────────────────────────────

function VoteButton({
  suggestionId,
  initialVoted,
  initialCount,
  userId,
}: {
  suggestionId: string;
  initialVoted: boolean;
  initialCount: number;
  userId: string | null;
}) {
  const [voted, setVoted] = useState(initialVoted);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    if (!userId || loading) return;
    setLoading(true);
    const supabase = createClient();

    if (voted) {
      const { error } = await supabase
        .from("topic_suggestion_votes")
        .delete()
        .eq("suggestion_id", suggestionId)
        .eq("user_id", userId);
      if (!error) {
        const newCount = Math.max(0, count - 1);
        await supabase
          .from("topic_suggestions")
          .update({ vote_count: newCount })
          .eq("id", suggestionId);
        setVoted(false);
        setCount(newCount);
      }
    } else {
      const { error } = await supabase
        .from("topic_suggestion_votes")
        .insert({ suggestion_id: suggestionId, user_id: userId });
      if (!error) {
        const newCount = count + 1;
        await supabase
          .from("topic_suggestions")
          .update({ vote_count: newCount })
          .eq("id", suggestionId);
        setVoted(true);
        setCount(newCount);
      }
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleToggle}
      disabled={!userId || loading}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
        voted
          ? "bg-brand-accent/10 text-brand-accent border border-brand-accent/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-400/30"
          : userId
            ? "bg-brand-surface border border-brand-border text-neutral-400 hover:border-brand-accent/40 hover:text-brand-accent"
            : "bg-brand-surface border border-brand-border text-neutral-600 cursor-not-allowed"
      }`}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
      {voted ? "Voted" : "Vote"} · {formatCount(count)}
    </button>
  );
}

// ── Suggestions page client ──────────────────────────────────────────────────

export function SuggestionsPageClient({
  suggestions,
  votedIds,
  userId,
}: {
  suggestions: SuggestionRow[];
  votedIds: string[];
  userId: string | null;
}) {
  const [search, setSearch] = useState("");
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const votedSet = new Set(votedIds);

  const toggleCat = useCallback((cat: string) => {
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const filtered = suggestions.filter((s) => {
    if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedCats.size > 0 && !s.categories.some((c) => selectedCats.has(c))) return false;
    return true;
  });

  return (
    <main className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        {/* Header */}
        <div>
          <Link
            href="/"
            className="text-xs font-mono text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            ← Back to Home
          </Link>
          <h1 className="font-display text-4xl sm:text-5xl tracking-wide mt-3">
            SUGGESTED TOPICS
          </h1>
          <p className="text-neutral-500 font-body text-sm mt-2">
            Vote for the debates you want to see. Suggestions expire after 30 days.
          </p>
        </div>

        {/* Search + filter */}
        <div className="space-y-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suggestions..."
            className="w-full px-4 py-3 rounded-xl bg-brand-surface border border-brand-border text-sm font-body text-white placeholder:text-neutral-600 focus:outline-none focus:border-brand-accent/50 transition-colors"
          />
          <div className="flex flex-wrap gap-1.5">
            {ALL_CATEGORIES.map((cat) => {
              const active = selectedCats.has(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCat(cat)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                    active
                      ? "border-brand-accent text-brand-accent bg-brand-accent/10"
                      : "border-brand-border text-neutral-500 hover:border-brand-accent/40"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-brand-border bg-brand-surface">
            <p className="font-display text-2xl text-neutral-600">NO SUGGESTIONS FOUND</p>
            <p className="text-sm text-neutral-600 mt-2 font-body">
              {suggestions.length === 0
                ? "Be the first to submit a topic suggestion!"
                : "Try adjusting your search or filters."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => {
              const days = daysRemaining(s.expires_at);
              return (
                <div
                  key={s.id}
                  className="flex items-start gap-4 p-5 rounded-xl bg-brand-surface border border-brand-border hover:border-brand-accent/20 transition-colors"
                >
                  {/* Vote */}
                  <div className="flex-shrink-0 pt-0.5">
                    <VoteButton
                      suggestionId={s.id}
                      initialVoted={votedSet.has(s.id)}
                      initialCount={s.vote_count}
                      userId={userId}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-lg tracking-wide text-white leading-tight">
                      {brandHighlight(s.title)}
                    </h3>
                    {s.description && (
                      <p className="text-sm font-body text-neutral-500 mt-1 line-clamp-2">
                        {s.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {s.categories.map((cat) => (
                        <span
                          key={cat}
                          className="px-2 py-0.5 rounded-md bg-brand-bg border border-brand-border text-[10px] font-mono text-neutral-500 uppercase tracking-wider"
                        >
                          {cat}
                        </span>
                      ))}
                      {s.submitter_username && (
                        <Link
                          href={`/profile/${s.submitter_username}`}
                          className="text-[10px] font-mono text-neutral-600 hover:text-brand-accent transition-colors"
                        >
                          by {s.submitter_display_name ?? s.submitter_username}
                        </Link>
                      )}
                      <span className="text-[10px] font-mono text-neutral-700 ml-auto">
                        {days}d remaining
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
