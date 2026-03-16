"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { awardAura } from "@/lib/aura";

const ALL_CATEGORIES = [
  "NFL", "NBA", "MLB", "Music", "Movies", "Gaming",
  "Combat", "Culture", "Sports", "Film", "Fashion", "TV", "Food",
] as const;

export function SubmitTopicCTA({
  userId,
  isPremium,
}: {
  userId: string | null;
  isPremium: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpen() {
    if (!userId) return;
    if (!isPremium) return;
    setOpen(true);
    setSuccess(false);
    setError(null);
  }

  function handleClose() {
    setOpen(false);
    setTitle("");
    setDescription("");
    setCategories(new Set());
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    if (!trimmedTitle || !trimmedDesc) {
      setError("Title and description are required.");
      return;
    }
    if (categories.size === 0) {
      setError("Select at least one category.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data: inserted, error: insertError } = await supabase
      .from("topic_suggestions")
      .insert({
        user_id: userId,
        title: trimmedTitle,
        description: trimmedDesc,
        categories: Array.from(categories),
      })
      .select("id")
      .single();

    setSubmitting(false);

    if (insertError) {
      setError("Failed to suggest. Please try again.");
      return;
    }

    // Award aura for suggesting a topic (max 5/day enforced in award_aura RPC)
    if (inserted?.id) {
      await awardAura(supabase, userId, "suggest_topic", inserted.id);
    }

    setSuccess(true);
    setTitle("");
    setDescription("");
    setCategories(new Set());
  }

  function toggleCategory(cat: string) {
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  return (
    <>
      <div className="rounded-xl border border-brand-accent/20 bg-brand-surface p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-brand-accent/5 rounded-full blur-2xl pointer-events-none" />
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-xs font-mono text-brand-accent mb-3">
          ★ PREMIUM
        </span>
        <h3 className="font-display text-xl tracking-wide text-white leading-tight mb-1">
          SUGGEST A TOPIC
        </h3>
        <p className="text-xs font-body text-neutral-500 leading-relaxed mb-4">
          Have a debate worth having? Premium members can suggest topics for the community.
        </p>

        {!userId ? (
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-brand-accent text-black text-sm font-display tracking-widest hover:bg-brand-accent/90 transition-colors duration-200"
          >
            SUGGEST A TOPIC
          </Link>
        ) : isPremium ? (
          <button
            onClick={handleOpen}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-brand-accent text-black text-sm font-display tracking-widest hover:bg-brand-accent/90 transition-colors duration-200"
          >
            SUGGEST A TOPIC
          </button>
        ) : (
          <Link
            href="/premium"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-brand-accent text-black text-sm font-display tracking-widest hover:bg-brand-accent/90 transition-colors duration-200"
          >
            UPGRADE TO SUGGEST
          </Link>
        )}
      </div>

      {/* Modal backdrop + form */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-bg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl tracking-wide">SUGGEST A TOPIC</h2>
              <button
                onClick={handleClose}
                className="text-neutral-500 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {success ? (
              <div className="py-8 text-center space-y-2">
                <p className="font-display text-xl text-brand-accent">TOPIC SUGGESTED</p>
                <p className="text-sm text-neutral-400 font-body">
                  Your suggestion is pending review. Thanks for contributing!
                </p>
                <button
                  onClick={handleClose}
                  className="mt-4 px-6 py-2 rounded-lg bg-brand-surface border border-brand-border text-sm font-mono text-neutral-300 hover:text-white hover:border-neutral-500 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-mono text-neutral-500 uppercase tracking-wider mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Top 5 Point Guards of All Time"
                    maxLength={120}
                    className="w-full px-3 py-2.5 rounded-lg bg-brand-surface border border-brand-border text-sm font-body text-white placeholder:text-neutral-600 focus:outline-none focus:border-brand-accent/50 transition-colors"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-mono text-neutral-500 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the debate..."
                    rows={3}
                    maxLength={500}
                    className="w-full px-3 py-2.5 rounded-lg bg-brand-surface border border-brand-border text-sm font-body text-white placeholder:text-neutral-600 focus:outline-none focus:border-brand-accent/50 transition-colors resize-none"
                  />
                </div>

                {/* Categories */}
                <div>
                  <label className="block text-xs font-mono text-neutral-500 uppercase tracking-wider mb-2">
                    Categories
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_CATEGORIES.map((cat) => {
                      const active = categories.has(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                            active
                              ? "border-brand-accent text-brand-accent bg-brand-accent/10"
                              : "border-brand-border text-neutral-400 hover:border-brand-accent/40"
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {error && (
                  <p className="text-red-400 text-xs font-mono">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-lg bg-brand-accent text-black text-sm font-display tracking-widest hover:bg-brand-accent/90 transition-colors disabled:opacity-50"
                >
                  {submitting ? "SUGGESTING..." : "SUGGEST TOPIC"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
