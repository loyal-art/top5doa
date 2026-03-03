"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import type { TopicStat } from "./page";

// ── Category nav ─────────────────────────────────────────────────────────────

const NAV_TABS = [
  "ALL", "NFL", "NBA", "MLB", "MUSIC", "MOVIES", "GAMING", "COMBAT", "CULTURE",
] as const;
type NavTab = (typeof NAV_TABS)[number];

// Maps each nav tab to the DB category it filters (null = no filter)
const TAB_CATEGORY: Record<NavTab, string | null> = {
  ALL:     null,
  NFL:     "Sports",
  NBA:     "Sports",
  MLB:     "Sports",
  MUSIC:   "Music",
  MOVIES:  "Film",
  GAMING:  "Gaming",
  COMBAT:  "Sports",
  CULTURE: "Culture",
};

// ── Category colour system ────────────────────────────────────────────────────

type CatStyle = { dot: string; text: string; bg: string; border: string };

const CAT_STYLES: Record<string, CatStyle> = {
  Sports:  { dot: "bg-orange-500",  text: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30"  },
  Music:   { dot: "bg-purple-500",  text: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/30"  },
  Film:    { dot: "bg-blue-500",    text: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30"    },
  Gaming:  { dot: "bg-green-500",   text: "text-green-400",   bg: "bg-green-500/10",   border: "border-green-500/30"   },
  Fashion: { dot: "bg-pink-500",    text: "text-pink-400",    bg: "bg-pink-500/10",    border: "border-pink-500/30"    },
  TV:      { dot: "bg-cyan-500",    text: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30"    },
  Food:    { dot: "bg-yellow-500",  text: "text-yellow-400",  bg: "bg-yellow-500/10",  border: "border-yellow-500/30"  },
  Culture: { dot: "bg-rose-500",    text: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/30"    },
};
const DEFAULT_STYLE: CatStyle = {
  dot: "bg-neutral-500", text: "text-neutral-400", bg: "bg-neutral-500/10", border: "border-neutral-500/30",
};
function catStyle(category: string): CatStyle {
  return CAT_STYLES[category] ?? DEFAULT_STYLE;
}

// ── Sort ──────────────────────────────────────────────────────────────────────

const SORT_OPTIONS = ["HOT", "NEW", "TOP"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

// ── Sub-components ────────────────────────────────────────────────────────────

function CategoryTag({ category }: { category: string }) {
  const s = catStyle(category);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md
                  text-xs font-mono font-bold uppercase border ${s.bg} ${s.border} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {category}
    </span>
  );
}

function TopicCard({ topic }: { topic: TopicStat }) {
  return (
    <Link
      href={`/topics/${topic.slug}`}
      className="group flex rounded-2xl border border-brand-border bg-brand-surface
                 hover:border-brand-accent/30 transition-all duration-200 overflow-hidden"
    >
      {/* ── Main content ── */}
      <div className="flex-1 p-5 min-w-0">
        {/* Status row */}
        <div className="flex items-center flex-wrap gap-2 mb-3">
          <CategoryTag category={topic.category} />
          {topic.userVoted ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono border bg-brand-accent/10 border-brand-accent/30 text-brand-accent">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              YOU VOTED
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono border bg-green-500/10 border-green-500/30 text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-display text-xl sm:text-2xl tracking-wide text-white
                       group-hover:text-brand-accent transition-colors leading-tight">
          {topic.title.toUpperCase()}
        </h3>

        {/* Attribute tags */}
        {topic.attributes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {topic.attributes.map((attr) => (
              <span
                key={attr}
                className="px-2 py-0.5 rounded text-xs font-mono text-neutral-600
                           bg-brand-bg border border-brand-border"
              >
                {attr}
              </span>
            ))}
          </div>
        )}

        {/* Voter count */}
        <div className="flex items-center gap-1.5 mt-4 text-xs font-mono text-neutral-600">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          {topic.voterCount.toLocaleString()} voter{topic.voterCount !== 1 ? "s" : ""}
        </div>
      </div>

      {/* ── Global Top 3 panel ── */}
      {topic.globalTop3.length > 0 && (
        <div className="w-[148px] flex-shrink-0 border-l border-brand-border p-4 bg-brand-bg/60">
          <p className="text-[10px] font-mono text-neutral-700 uppercase tracking-wider mb-3">
            Global Top 3
          </p>
          <div className="space-y-2.5">
            {topic.globalTop3.map((item, i) => (
              <div key={i} className="flex items-center gap-2 min-w-0">
                <span
                  className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center
                              text-[10px] font-mono font-bold
                              ${i === 0
                                ? "bg-brand-accent/20 text-brand-accent"
                                : i === 1
                                ? "bg-neutral-700 text-neutral-300"
                                : "bg-neutral-800 text-neutral-500"
                              }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-mono truncate leading-tight
                                 ${i === 0 ? "text-brand-accent" : "text-neutral-400"}`}>
                    {item.name}
                  </p>
                  {item.era && (
                    <p className="text-[10px] font-mono text-neutral-700 truncate">{item.era}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Link>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function HomeClient({
  topics,
  isPremium,
}: {
  topics: TopicStat[];
  isPremium: boolean;
}) {
  const [activeTab, setActiveTab] = useState<NavTab>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>("HOT");
  const [browseFilter, setBrowseFilter] = useState<"voted" | null>(null);

  function handleTabClick(tab: NavTab) {
    setActiveTab(tab);
    setCategoryFilter(TAB_CATEGORY[tab]);
    setBrowseFilter(null);
  }

  function handleSidebarCategory(cat: string) {
    setCategoryFilter(cat);
    setBrowseFilter(null);
    // Sync the active nav tab to the first tab that maps to this category
    const match = (Object.entries(TAB_CATEGORY) as [NavTab, string | null][])
      .find(([, v]) => v === cat)?.[0];
    setActiveTab(match ?? "ALL");
  }

  // Hero: topic with the most voters
  const heroTopic = useMemo(
    () => [...topics].sort((a, b) => b.voterCount - a.voterCount)[0] ?? null,
    [topics]
  );

  // Sidebar category list with counts
  const dbCategories = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of topics) map.set(t.category, (map.get(t.category) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [topics]);

  // Trending (top 5 by voter count)
  const trending = useMemo(
    () => [...topics].sort((a, b) => b.voterCount - a.voterCount).slice(0, 5),
    [topics]
  );

  // Filtered + sorted feed
  const feed = useMemo(() => {
    let list = [...topics];
    if (browseFilter === "voted") list = list.filter((t) => t.userVoted);
    if (categoryFilter) list = list.filter((t) => t.category === categoryFilter);
    if (sort === "NEW") {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      // HOT and TOP both rank by voter count
      list.sort((a, b) => b.voterCount - a.voterCount);
    }
    return list;
  }, [topics, categoryFilter, browseFilter, sort]);

  const heroCat = heroTopic ? catStyle(heroTopic.category) : null;

  return (
    <div className="min-h-screen">

      {/* ── Category nav bar ──────────────────────────────────────────────── */}
      <nav className="sticky top-16 z-40 border-b border-brand-border bg-brand-bg/95 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center overflow-x-auto">
            {NAV_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabClick(tab)}
                className={`flex-shrink-0 px-4 py-3.5 text-xs font-mono font-bold tracking-widest
                            border-b-2 transition-colors
                            ${activeTab === tab
                              ? "border-brand-accent text-brand-accent"
                              : "border-transparent text-neutral-600 hover:text-neutral-300"
                            }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Hero banner ───────────────────────────────────────────────────── */}
      {heroTopic && heroCat && (
        <section className="relative overflow-hidden border-b border-brand-border">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/4 via-transparent to-brand-aura/4 pointer-events-none" />
          <div className="absolute -top-20 left-1/4 w-[500px] h-[300px] bg-brand-accent/4 rounded-full blur-[120px] pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 py-10 relative">
            <div className="flex items-start justify-between gap-6">

              {/* Left: info + CTA */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <CategoryTag category={heroTopic.category} />
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    LIVE NOW
                  </span>
                </div>
                <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-wide
                               leading-tight text-white">
                  {heroTopic.title.toUpperCase()}
                </h2>
                {heroTopic.description && (
                  <p className="text-neutral-400 text-sm font-body mt-2 max-w-xl line-clamp-2 leading-relaxed">
                    {heroTopic.description}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-5">
                  <span className="text-sm font-mono text-neutral-500">
                    {heroTopic.voterCount.toLocaleString()} voters
                  </span>
                  <Link
                    href={`/topics/${heroTopic.slug}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                               bg-brand-accent text-brand-bg text-sm font-mono font-bold
                               hover:bg-brand-accent/90 transition-colors"
                  >
                    MAKE YOUR LIST
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>
              </div>

              {/* Right: community top 3 */}
              {heroTopic.globalTop3.length > 0 && (
                <div className="hidden sm:block flex-shrink-0 p-5 rounded-2xl bg-brand-surface
                                border border-brand-border min-w-[200px]">
                  <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-wider mb-4">
                    Community Top 3
                  </p>
                  <div className="space-y-3">
                    {heroTopic.globalTop3.map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span
                          className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center
                                      justify-center text-xs font-mono font-bold
                                      ${i === 0
                                        ? "bg-brand-accent/20 text-brand-accent"
                                        : i === 1
                                        ? "bg-neutral-700 text-neutral-300"
                                        : "bg-neutral-800 text-neutral-500"
                                      }`}
                        >
                          {i + 1}
                        </span>
                        <div>
                          <p className={`text-sm font-mono leading-tight
                                        ${i === 0 ? "text-brand-accent font-bold" : "text-white"}`}>
                            {item.name}
                          </p>
                          {item.era && (
                            <p className="text-[10px] font-mono text-neutral-600">{item.era}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 3-column layout ───────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_260px] gap-6">

          {/* ── Left sidebar ──────────────────────────────────────────────── */}
          <aside className="hidden lg:flex flex-col gap-6">

            {/* Browse */}
            <div>
              <h3 className="font-display text-xs tracking-widest text-neutral-600 mb-3 px-3">
                BROWSE
              </h3>
              <div className="space-y-0.5">
                {(
                  [
                    { label: "Trending",   icon: "fire",  sort: "HOT" as SortOption, filter: null },
                    { label: "New Topics", icon: "plus",  sort: "NEW" as SortOption, filter: null },
                    { label: "My Voted",   icon: "check", sort: null,               filter: "voted" as const },
                  ] as const
                ).map((item) => {
                  const isActive = item.filter !== null && browseFilter === item.filter;
                  return (
                    <button
                      key={item.label}
                      onClick={() => {
                        setBrowseFilter(item.filter);
                        if (item.sort) setSort(item.sort);
                        setActiveTab("ALL");
                        setCategoryFilter(null);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                                  text-sm font-mono transition-colors text-left
                                  ${isActive
                                    ? "bg-brand-accent/10 text-brand-accent"
                                    : "text-neutral-500 hover:text-white hover:bg-brand-surface"
                                  }`}
                    >
                      {item.icon === "fire" && (
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                        </svg>
                      )}
                      {item.icon === "plus" && (
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                      {item.icon === "check" && (
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Categories */}
            {dbCategories.length > 0 && (
              <div>
                <h3 className="font-display text-xs tracking-widest text-neutral-600 mb-3 px-3">
                  CATEGORIES
                </h3>
                <div className="space-y-0.5">
                  {dbCategories.map(([cat, count]) => {
                    const s = catStyle(cat);
                    const isActive = categoryFilter === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => handleSidebarCategory(cat)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl
                                    text-sm font-mono transition-colors
                                    ${isActive
                                      ? "bg-brand-surface text-white"
                                      : "text-neutral-500 hover:text-white hover:bg-brand-surface"
                                    }`}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                        <span className="flex-1 text-left">{cat}</span>
                        <span className="text-xs font-mono text-neutral-700 bg-brand-bg px-1.5 py-0.5 rounded">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>

          {/* ── Main feed ─────────────────────────────────────────────────── */}
          <main>
            {/* Sort bar */}
            <div className="flex items-center gap-2 mb-6">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => { setSort(opt); setBrowseFilter(null); }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-mono font-bold
                              tracking-wider border transition-colors
                              ${sort === opt && !browseFilter
                                ? "bg-brand-accent text-brand-bg border-transparent"
                                : "border-brand-border text-neutral-600 hover:text-white hover:border-neutral-500"
                              }`}
                >
                  {opt}
                </button>
              ))}
              <span className="ml-auto text-xs font-mono text-neutral-700">
                {feed.length} topic{feed.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Cards */}
            {feed.length > 0 ? (
              <div className="space-y-4">
                {feed.map((topic) => (
                  <TopicCard key={topic.id} topic={topic} />
                ))}
              </div>
            ) : (
              <div className="py-16 rounded-2xl border border-brand-border bg-brand-surface text-center">
                <p className="font-display text-2xl text-neutral-600">NO TOPICS FOUND</p>
                <p className="text-sm font-mono text-neutral-700 mt-2">
                  {browseFilter === "voted"
                    ? "You haven't voted on anything yet."
                    : "Nothing in this category yet."}
                </p>
              </div>
            )}
          </main>

          {/* ── Right sidebar ─────────────────────────────────────────────── */}
          <aside className="hidden lg:flex flex-col gap-6">

            {/* Trending Now */}
            {trending.length > 0 && (
              <div className="p-5 rounded-2xl bg-brand-surface border border-brand-border">
                <h3 className="font-display text-xs tracking-widest text-neutral-400 mb-4">
                  TRENDING NOW
                </h3>
                <div className="space-y-4">
                  {trending.map((t, i) => {
                    const s = catStyle(t.category);
                    return (
                      <Link
                        key={t.id}
                        href={`/topics/${t.slug}`}
                        className="flex items-start gap-3 group"
                      >
                        <span className="flex-shrink-0 font-display text-2xl leading-none
                                         text-neutral-800 group-hover:text-brand-accent
                                         transition-colors pt-0.5 w-6 text-right">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-mono text-neutral-300
                                        group-hover:text-brand-accent transition-colors
                                        leading-snug line-clamp-2">
                            {t.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-mono ${s.text}`}>
                              {t.category}
                            </span>
                            <span className="text-[10px] font-mono text-neutral-700">
                              {t.voterCount.toLocaleString()} voters
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Submit a topic */}
            {isPremium ? (
              <Link
                href="/admin"
                className="block p-5 rounded-2xl bg-brand-accent/5 border border-brand-accent/20
                           hover:border-brand-accent/40 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <h3 className="font-display text-xs tracking-widest text-brand-accent">
                    SUBMIT A TOPIC
                  </h3>
                </div>
                <p className="text-xs font-mono text-neutral-500 leading-relaxed">
                  Got a GOAT debate in mind? Submit it for the community to vote on.
                </p>
                <span className="inline-block mt-3 text-xs font-mono font-bold text-brand-accent
                                 group-hover:underline">
                  Submit now →
                </span>
              </Link>
            ) : (
              <div className="p-5 rounded-2xl bg-brand-surface border border-brand-border">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <h3 className="font-display text-xs tracking-widest text-neutral-500">
                    SUBMIT A TOPIC
                  </h3>
                </div>
                <p className="text-xs font-mono text-neutral-600 leading-relaxed">
                  Premium members can submit topics for the community to debate.
                </p>
                <span className="inline-block mt-3 px-3 py-1.5 rounded-lg bg-brand-accent/10
                                 border border-brand-accent/20 text-xs font-mono
                                 text-brand-accent font-bold">
                  PREMIUM ONLY
                </span>
              </div>
            )}
          </aside>

        </div>
      </div>
    </div>
  );
}
