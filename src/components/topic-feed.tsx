"use client";

import { useState, useMemo } from "react";

const PAGE_SIZE = 12;

type TopicFeedProps = {
  children: React.ReactNode;
  titles: string[];
  subjectNames?: string[][];
  hotTakeContents?: string[][];
};

export function TopicFeed({ children, titles, subjectNames, hotTakeContents }: TopicFeedProps) {
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // children is an array of TopicCard elements — we need to filter by index
  const childArray = Array.isArray(children) ? children : children ? [children] : [];

  const matchingIndices = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return titles.map((_, i) => i);
    return titles
      .map((title, i) => {
        if (title.toLowerCase().includes(q)) return i;
        const subjects = subjectNames?.[i];
        if (subjects?.some((s) => s.toLowerCase().includes(q))) return i;
        const takes = hotTakeContents?.[i];
        if (takes?.some((t) => t.toLowerCase().includes(q))) return i;
        return -1;
      })
      .filter((i) => i !== -1);
  }, [search, titles, subjectNames, hotTakeContents]);

  // Track which indices matched via hot take content (not title or subject)
  const hotTakeMatchIndices = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return new Set<number>();
    const set = new Set<number>();
    for (const i of matchingIndices) {
      const titleMatch = titles[i].toLowerCase().includes(q);
      const subjectMatch = subjectNames?.[i]?.some((s) => s.toLowerCase().includes(q));
      if (!titleMatch && !subjectMatch) {
        // Matched only via hot take content
        set.add(i);
      }
    }
    return set;
  }, [search, matchingIndices, titles, subjectNames]);

  const paginatedIndices = matchingIndices.slice(0, visibleCount);
  const hasMore = matchingIndices.length > visibleCount;

  // Reset pagination when search changes
  const handleSearch = (value: string) => {
    setSearch(value);
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <>
      {/* Search bar */}
      <div className="relative mb-5">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search topics, subjects, or hot takes..."
          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-brand-surface border border-brand-border text-white font-body text-sm placeholder-neutral-600 focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/30 transition-colors"
        />
        {search && (
          <button
            type="button"
            onClick={() => handleSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Topic cards */}
      {paginatedIndices.length > 0 ? (
        <div className="flex flex-col gap-4">
          {paginatedIndices.map((i) => (
            <div key={i}>
              {childArray[i]}
              {hotTakeMatchIndices.has(i) && search && (
                <div className="mt-1 px-4">
                  <span className="inline-flex items-center gap-1 text-xs font-mono" style={{ color: "#FF4500" }}>
                    🔥 Has hot takes matching &ldquo;{search.trim()}&rdquo;
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 rounded-2xl border border-brand-border bg-brand-surface">
          <p className="font-display text-2xl text-neutral-600">
            {search ? "NO MATCHING TOPICS" : "NO ACTIVE DEBATES YET"}
          </p>
          <p className="text-sm text-neutral-600 mt-2 font-body">
            {search ? "Try a different search term." : "Check back soon — debates are coming."}
          </p>
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center mt-6">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="px-8 py-2.5 rounded-xl bg-brand-surface border border-brand-border text-neutral-400 font-display text-sm tracking-widest hover:text-white hover:border-neutral-500 transition-all duration-200"
          >
            LOAD MORE
          </button>
        </div>
      )}

      {/* Result count when searching */}
      {search && paginatedIndices.length > 0 && (
        <p className="text-xs font-mono text-neutral-600 mt-3 text-center">
          {matchingIndices.length} result{matchingIndices.length !== 1 ? "s" : ""}
          {hasMore && ` · showing ${paginatedIndices.length}`}
        </p>
      )}
    </>
  );
}
