"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { brandHighlight } from "@/lib/utils";
import { awardAura } from "@/lib/aura";

export type SuggestionRow = {
  id: string;
  title: string;
  description: string;
  categories: string[];
  vote_count: number;
  user_id: string;
  submitter_username: string | null;
  submitter_display_name: string | null;
  expires_at: string;
};

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
  onVoteChange,
}: {
  suggestionId: string;
  initialVoted: boolean;
  initialCount: number;
  userId: string | null;
  onVoteChange?: (voted: boolean, newCount: number) => void;
}) {
  const [voted, setVoted] = useState(initialVoted);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    if (!userId || loading) return;
    setLoading(true);
    const supabase = createClient();

    if (voted) {
      // Unvote
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
        onVoteChange?.(false, newCount);
      }
    } else {
      // Vote
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
        onVoteChange?.(true, newCount);
        // Award aura for voting on a suggestion
        await awardAura(supabase, userId, "suggestion_vote", suggestionId);
      }
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleToggle}
      disabled={!userId || loading}
      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono transition-colors ${
        voted
          ? "bg-brand-accent/10 text-brand-accent border border-brand-accent/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-400/30"
          : userId
            ? "bg-brand-surface border border-brand-border text-neutral-400 hover:border-brand-accent/40 hover:text-brand-accent"
            : "bg-brand-surface border border-brand-border text-neutral-600 cursor-not-allowed"
      }`}
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
      {voted ? "Voted" : formatCount(count)}
    </button>
  );
}

// ── PiP Detail Panel (draggable floating panel) ─────────────────────────────

function SuggestionPipPanel({
  suggestion,
  voted: initialVoted,
  userId,
  onClose,
}: {
  suggestion: SuggestionRow;
  voted: boolean;
  userId: string | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, left: 0, top: 0 });
  const [pipVoteCount, setPipVoteCount] = useState(suggestion.vote_count);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({
        left: dragStart.current.left + (e.clientX - dragStart.current.mx),
        top: dragStart.current.top + (e.clientY - dragStart.current.my),
      });
    };
    const onUp = () => { dragging.current = false; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  const handleDragMouseDown = (e: React.MouseEvent) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, left: rect.left, top: rect.top };
    e.preventDefault();
  };

  const style: React.CSSProperties = pos
    ? { position: "fixed", left: pos.left, top: pos.top, zIndex: 9999, width: 380 }
    : { position: "fixed", right: 24, bottom: 24, zIndex: 9999, width: 380 };

  const days = daysRemaining(suggestion.expires_at);

  return (
    <div ref={panelRef} style={style} className="rounded-xl overflow-hidden shadow-2xl border border-neutral-700 bg-neutral-900 flex flex-col">
      {/* Drag handle */}
      <div
        onMouseDown={handleDragMouseDown}
        className="flex items-center justify-between px-3 py-2 bg-neutral-800 cursor-grab active:cursor-grabbing select-none border-b border-neutral-700"
      >
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
          </div>
          <span className="text-xs font-mono text-neutral-400 tracking-widest uppercase">
            Suggestion
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-neutral-700 text-neutral-500 hover:text-white transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <h3 className="font-display text-xl tracking-wide text-white leading-tight">
          {brandHighlight(suggestion.title)}
        </h3>

        {suggestion.description && (
          <p className="text-sm font-body text-neutral-400 leading-relaxed">
            {suggestion.description}
          </p>
        )}

        {/* Categories */}
        {suggestion.categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestion.categories.map((cat) => (
              <span
                key={cat}
                className="px-2 py-0.5 rounded-md bg-brand-bg border border-brand-border text-[10px] font-mono text-neutral-500 uppercase tracking-wider"
              >
                {cat}
              </span>
            ))}
          </div>
        )}

        {/* Submitter */}
        {suggestion.submitter_username && (
          <p className="text-xs font-mono text-neutral-600">
            Submitted by{" "}
            <Link
              href={`/profile/${suggestion.submitter_username}`}
              className="text-neutral-400 hover:text-brand-accent transition-colors"
            >
              {suggestion.submitter_display_name ?? suggestion.submitter_username}
            </Link>
          </p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 pt-2 border-t border-neutral-700">
          <div className="flex items-center gap-1.5 text-xs font-mono text-neutral-500">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
            {formatCount(pipVoteCount)} votes
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-neutral-500">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {days}d left
          </div>
          <div className="ml-auto">
            <VoteButton
              suggestionId={suggestion.id}
              initialVoted={initialVoted}
              initialCount={suggestion.vote_count}
              userId={userId}
              onVoteChange={(_voted, newCount) => setPipVoteCount(newCount)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main panel (sidebar) ─────────────────────────────────────────────────────

export function SuggestedTopicsPanel({
  suggestions,
  votedIds: initialVotedIds,
  userId,
  totalCount,
}: {
  suggestions: SuggestionRow[];
  votedIds: string[];
  userId: string | null;
  totalCount: number;
}) {
  const votedSet = new Set(initialVotedIds);
  const [pipSuggestion, setPipSuggestion] = useState<SuggestionRow | null>(null);

  const openPip = useCallback((s: SuggestionRow) => {
    setPipSuggestion(s);
  }, []);

  if (suggestions.length === 0) return null;

  return (
    <>
      <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
        <h3 className="font-display text-xs tracking-[0.2em] text-neutral-500 mb-3 px-1">
          SUGGESTED TOPICS
        </h3>
        <ol className="flex flex-col gap-0.5">
          {suggestions.map((s, i) => {
            const days = daysRemaining(s.expires_at);
            return (
              <li key={s.id}>
                <div className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-white/5 transition-colors duration-150">
                  <span className="font-display text-lg leading-none text-neutral-600 w-5 text-right flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => openPip(s)}
                      className="text-sm font-body text-neutral-300 truncate block w-full text-left hover:text-brand-accent transition-colors"
                    >
                      {s.title}
                    </button>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-mono text-neutral-600">
                        {formatCount(s.vote_count)} votes
                      </span>
                      <span className="text-[10px] font-mono text-neutral-700">
                        {days}d left
                      </span>
                    </div>
                  </div>
                  <VoteButton
                    suggestionId={s.id}
                    initialVoted={votedSet.has(s.id)}
                    initialCount={s.vote_count}
                    userId={userId}
                  />
                </div>
              </li>
            );
          })}
        </ol>
        <Link
          href="/suggestions"
          className="flex items-center justify-center w-full mt-3 px-2 py-2 rounded-lg text-xs font-mono text-brand-accent hover:bg-brand-accent/5 transition-colors"
        >
          View All Suggestions{totalCount > 5 ? ` (${totalCount})` : ""}
        </Link>
      </div>

      {pipSuggestion && (
        <SuggestionPipPanel
          suggestion={pipSuggestion}
          voted={votedSet.has(pipSuggestion.id)}
          userId={userId}
          onClose={() => setPipSuggestion(null)}
        />
      )}
    </>
  );
}
