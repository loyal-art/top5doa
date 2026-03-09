"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const ALL_CATEGORIES = [
  "NFL", "NBA", "MLB", "Music", "Movies", "Gaming",
  "Combat", "Culture", "Sports", "Film", "Fashion", "TV", "Food",
] as const;

export type SuggestionRow = {
  id: string;
  title: string;
  description: string;
  categories: string[];
  vote_count: number;
  user_id: string;
  submitter_username: string | null;
  submitter_display_name: string | null;
};

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── Inline vote button ───────────────────────────────────────────────────────

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

  async function handleVote() {
    if (!userId || voted || loading) return;
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("topic_suggestion_votes")
      .insert({ suggestion_id: suggestionId, user_id: userId });

    if (!error) {
      // Increment vote_count on the suggestion
      await supabase
        .from("topic_suggestions")
        .update({ vote_count: count + 1 })
        .eq("id", suggestionId);
      setVoted(true);
      setCount((c) => c + 1);
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleVote}
      disabled={!userId || voted || loading}
      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono transition-colors ${
        voted
          ? "bg-brand-accent/10 text-brand-accent border border-brand-accent/30"
          : userId
            ? "bg-brand-surface border border-brand-border text-neutral-400 hover:border-brand-accent/40 hover:text-brand-accent"
            : "bg-brand-surface border border-brand-border text-neutral-600 cursor-not-allowed"
      }`}
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
      {formatCount(count)}
    </button>
  );
}

// ── See All Modal ────────────────────────────────────────────────────────────

function SeeAllModal({
  allSuggestions,
  votedIds,
  userId,
  onClose,
}: {
  allSuggestions: SuggestionRow[];
  votedIds: Set<string>;
  userId: string | null;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());

  function toggleCat(cat: string) {
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  const filtered = allSuggestions.filter((s) => {
    if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedCats.size > 0 && !s.categories.some((c) => selectedCats.has(c))) return false;
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl max-h-[80vh] rounded-2xl border border-brand-border bg-brand-bg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-brand-border">
          <h2 className="font-display text-2xl tracking-wide">SUGGESTED TOPICS</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search + filter */}
        <div className="px-6 py-4 space-y-3 border-b border-brand-border">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suggestions..."
            className="w-full px-3 py-2 rounded-lg bg-brand-surface border border-brand-border text-sm font-body text-white placeholder:text-neutral-600 focus:outline-none focus:border-brand-accent/50 transition-colors"
          />
          <div className="flex flex-wrap gap-1.5">
            {ALL_CATEGORIES.map((cat) => {
              const active = selectedCats.has(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCat(cat)}
                  className={`px-2 py-1 rounded-md border text-xs font-mono transition-colors ${
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

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filtered.length === 0 ? (
            <p className="text-center text-sm font-mono text-neutral-600 py-8">No suggestions found</p>
          ) : (
            filtered.map((s) => (
              <div
                key={s.id}
                className="flex items-start gap-3 p-4 rounded-xl bg-brand-surface border border-brand-border"
              >
                {/* Vote */}
                <div className="flex-shrink-0 pt-0.5">
                  <VoteButton
                    suggestionId={s.id}
                    initialVoted={votedIds.has(s.id)}
                    initialCount={s.vote_count}
                    userId={userId}
                  />
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body text-white">{s.title}</p>
                  {s.description && (
                    <p className="text-xs font-body text-neutral-500 mt-1 line-clamp-2">{s.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
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
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main panel (sidebar) ─────────────────────────────────────────────────────

export function SuggestedTopicsPanel({
  suggestions,
  allSuggestions,
  votedIds: initialVotedIds,
  userId,
}: {
  suggestions: SuggestionRow[];
  allSuggestions: SuggestionRow[];
  votedIds: string[];
  userId: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const votedSet = new Set(initialVotedIds);

  if (suggestions.length === 0) return null;

  return (
    <>
      <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
        <h3 className="font-display text-xs tracking-[0.2em] text-neutral-500 mb-3 px-1">
          SUGGESTED TOPICS
        </h3>
        <ol className="flex flex-col gap-0.5">
          {suggestions.map((s, i) => (
            <li key={s.id}>
              <div className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-white/5 transition-colors duration-150">
                <span className="font-display text-lg leading-none text-neutral-600 w-5 text-right flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body text-neutral-300 truncate">
                    {s.title}
                  </p>
                  <p className="text-xs font-mono text-neutral-600 mt-0.5">
                    {formatCount(s.vote_count)} votes
                  </p>
                </div>
                <VoteButton
                  suggestionId={s.id}
                  initialVoted={votedSet.has(s.id)}
                  initialCount={s.vote_count}
                  userId={userId}
                />
              </div>
            </li>
          ))}
        </ol>
        {allSuggestions.length > 5 && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full mt-3 px-2 py-2 rounded-lg text-xs font-mono text-brand-accent hover:bg-brand-accent/5 transition-colors"
          >
            See All ({allSuggestions.length})
          </button>
        )}
      </div>

      {showAll && (
        <SeeAllModal
          allSuggestions={allSuggestions}
          votedIds={votedSet}
          userId={userId}
          onClose={() => setShowAll(false)}
        />
      )}
    </>
  );
}
