import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ShareButton } from "@/components/share-button";
import { SubmitTopicCTA } from "@/components/submit-topic-cta";
import { SuggestedTopicsPanel } from "@/components/suggested-topics-panel";
import type { SuggestionRow } from "@/components/suggested-topics-panel";
import { extractYouTubeId, youtubeBackgroundSrc } from "@/lib/youtube";
import { brandHighlight } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Topic = {
  id: string;
  title: string;
  slug: string;
  category: string[];
  description: string | null;
  cover_image_url: string | null;
  card_image_url: string | null;
  card_video_url: string | null;
  view_count: number;
};

type GlobalRanking = { subject_id: string; avg_score: number };

// ─── Brand Highlight ─────────────────────────────────────────────────────────

/** Wrap specific words in a gold-glow span */
function brandHighlight(text: string, words: string[]): React.ReactNode {
  const pattern = new RegExp(`(${words.join("|")})`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    words.some((w) => w.toLowerCase() === part.toLowerCase()) ? (
      <span
        key={i}
        className="text-brand-accent"
        style={{ textShadow: "0 0 20px rgba(232,255,0,0.5), 0 0 40px rgba(232,255,0,0.25)" }}
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NAV_TABS = [
  { label: "ALL", value: "all" },
  { label: "🏈 NFL", value: "nfl" },
  { label: "🏀 NBA", value: "nba" },
  { label: "⚾ MLB", value: "mlb" },
  { label: "🎵 MUSIC", value: "music" },
  { label: "🎬 MOVIES", value: "movies" },
  { label: "🎮 GAMING", value: "gaming" },
  { label: "🥊 COMBAT", value: "combat" },
  { label: "🌍 CULTURE", value: "culture" },
  { label: "👗 FASHION", value: "fashion" },
  { label: "🏆 SPORTS", value: "sports" },
] as const;

const SORT_TABS = [
  { label: "HOT", value: "hot" },
  { label: "NEW", value: "new" },
  { label: "TOP", value: "top" },
] as const;

const BROWSE_LINKS = [
  { label: "Trending", href: "/?sort=top" },
  { label: "Featured", href: "/" },
  { label: "New Topics", href: "/?sort=new" },
  { label: "My Voted", href: "/?browse=voted" },
];

// Category accent colors — keyed on lowercase category name
const CATEGORY_COLOR: Record<string, string> = {
  nfl: "#4ade80",
  nba: "#60a5fa",
  mlb: "#f97316",
  music: "#a78bfa",
  movies: "#f472b6",
  gaming: "#34d399",
  combat: "#ef4444",
  culture: "#fbbf24",
  fashion: "#ec4899",
  sports: "#60a5fa",
  film: "#f472b6",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function categoryColor(cat: string): string {
  return CATEGORY_COLOR[cat.toLowerCase()] ?? "#e8ff00";
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ─── Coming Soon Card ─────────────────────────────────────────────────────────

function ComingSoonCard({
  topic,
  alertHref,
}: {
  topic: Topic;
  alertHref: string;
}) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{ background: "#080808", border: "2px dashed #e8ff00" }}
    >
      {/* Subtle glow */}
      <div
        className="absolute top-0 left-0 w-48 h-24 rounded-full blur-[60px] opacity-10 pointer-events-none"
        style={{ backgroundColor: "#e8ff00" }}
      />

      <div className="relative flex items-center gap-4 p-5">
        {/* Left: badges + title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#e8ff00]/10 border border-[#e8ff00]/40 text-xs font-mono text-[#e8ff00] tracking-[0.15em]">
              COMING SOON
            </span>
            {topic.category.map((cat) => {
              const color = categoryColor(cat);
              return (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-brand-bg border border-brand-border text-xs font-mono uppercase tracking-wider opacity-50"
                  style={{ color }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  {cat}
                </span>
              );
            })}
          </div>
          <h3 className="font-display text-xl sm:text-2xl tracking-wide text-neutral-500 leading-tight">
            {brandHighlight(topic.title)}
          </h3>
        </div>

        {/* Right: GET NOTIFIED */}
        <Link
          href={alertHref}
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#e8ff00]/40 text-[#e8ff00]/60 font-mono text-xs tracking-widest hover:bg-[#e8ff00]/10 hover:border-[#e8ff00] hover:text-[#e8ff00] transition-all duration-200"
        >
          GET NOTIFIED
        </Link>
      </div>
    </div>
  );
}

// ─── Topic Card ───────────────────────────────────────────────────────────────

function TopicCard({
  topic,
  attributes,
  hasVoted,
  top3,
  viewCount,
}: {
  topic: Topic;
  attributes: { id: string; name: string }[];
  hasVoted: boolean;
  top3: { name: string; score: number }[];
  viewCount: number;
}) {
  const MAX_CHIPS = 3;
  const visibleAttrs = attributes.slice(0, MAX_CHIPS);
  const overflowCount = attributes.length - MAX_CHIPS;

  return (
    <Link
      href={`/topics/${topic.slug}`}
      className="group relative flex rounded-2xl border border-brand-border bg-brand-surface hover:border-brand-accent/40 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/40 overflow-hidden"
      style={{ transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.3s ease" }}
    >
      {/* Card background video or image */}
      {(() => {
        const videoId = topic.card_video_url ? extractYouTubeId(topic.card_video_url) : null;
        if (videoId) {
          return (
            <>
              {/* Desktop: YouTube iframe */}
              <div className="absolute inset-0 hidden md:block pointer-events-none">
                <iframe
                  src={youtubeBackgroundSrc(videoId)}
                  className="absolute inset-0 w-full h-full"
                  style={{ border: 0, transform: "scale(1.5)" }}
                  allow="autoplay; encrypted-media"
                  tabIndex={-1}
                  title="Card background video"
                />
              </div>
              {/* Mobile: fall back to card_image_url */}
              {topic.card_image_url && (
                <img
                  src={topic.card_image_url}
                  alt=""
                  className="absolute inset-0 w-full h-full pointer-events-none md:hidden"
                  style={{ objectFit: "cover" }}
                />
              )}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "linear-gradient(to right, rgba(0,0,0,0.9), rgba(0,0,0,0.6))",
                }}
              />
            </>
          );
        }
        if (topic.card_image_url) {
          return (
            <>
              <img
                src={topic.card_image_url}
                alt=""
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ objectFit: "cover" }}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "linear-gradient(to right, rgba(0,0,0,0.9), rgba(0,0,0,0.6))",
                }}
              />
            </>
          );
        }
        return null;
      })()}
      {/* Hover glow overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/0 group-hover:from-brand-accent/[0.04] to-transparent transition-all duration-300 pointer-events-none" />

      {/* ── Left: main content ── */}
      <div className="relative flex-1 p-5 flex flex-col gap-3 min-w-0">

        {/* Top row: category + status badge */}
        <div className="flex items-center gap-2 flex-wrap">
          {topic.category.map((cat) => {
            const color = categoryColor(cat);
            return (
              <span
                key={cat}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-brand-bg border border-brand-border text-xs font-mono uppercase tracking-wider"
                style={{ color }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                {cat}
              </span>
            );
          })}

          {hasVoted ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-aura/10 border border-brand-aura/30 text-xs font-mono text-brand-aura">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              YOU VOTED
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-xs font-mono text-brand-accent">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
              LIVE
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-display text-2xl tracking-wide text-white group-hover:text-brand-accent transition-colors duration-300 leading-tight">
          {brandHighlight(topic.title)}
        </h3>

        {/* Attribute chips */}
        {visibleAttrs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {visibleAttrs.map((attr) => (
              <span
                key={attr.id}
                className="px-2 py-0.5 rounded-md bg-brand-bg border border-brand-border text-xs font-mono text-neutral-500 tracking-wide"
              >
                {attr.name}
              </span>
            ))}
            {overflowCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-brand-bg border border-brand-border text-xs font-mono text-neutral-600">
                +{overflowCount}
              </span>
            )}
          </div>
        )}

        {/* Footer: views + share */}
        <div className="flex items-center gap-3 mt-auto pt-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-neutral-600">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-aura/60" />
            {formatCount(viewCount)} views
          </span>
          <ShareButton title={topic.title} path={`/topics/${topic.slug}`} />
        </div>
      </div>

      {/* ── Right: Global Top 3 ── */}
      <div className="relative flex-shrink-0 w-44 border-l border-brand-border bg-brand-bg/40 p-4 flex flex-col">
        <p className="font-display text-[10px] tracking-[0.2em] text-neutral-600 mb-3">
          GLOBAL TOP 3
        </p>

        {top3.length > 0 ? (
          <ol className="flex flex-col gap-2 flex-1">
            {top3.map((entry, i) => (
              <li key={i} className="flex items-center gap-2 min-w-0">
                <span
                  className="font-display text-base leading-none flex-shrink-0 w-4"
                  style={{
                    color: i === 0 ? "#e8ff00" : i === 1 ? "#a78bfa" : "#6b7280",
                  }}
                >
                  {i + 1}
                </span>
                <span className="text-xs font-body text-neutral-300 truncate flex-1">
                  {entry.name}
                </span>
                <span className="text-[10px] font-mono text-neutral-600 flex-shrink-0">
                  {entry.score}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs font-mono text-neutral-700 mt-1">No votes yet</p>
        )}

        <div className="mt-auto pt-3">
          <span className="text-[10px] font-mono text-brand-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Enter debate →
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; sort?: string; browse?: string }>;
}) {
  const params = await searchParams;
  const activeBrowse = params.browse ?? null;
  const activeCat = params.cat ?? "all";
  const activeSort = params.sort ?? "hot";

  const supabase = await createClient();

  // Auth user (for YOU VOTED status)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Active topics
  const { data: topics } = await supabase
    .from("topics")
    .select("id, title, slug, category, description, cover_image_url, card_image_url, card_video_url, view_count")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  // Featured topic (for hero banner)
  const { data: featuredData } = await supabase
    .from("topics")
    .select("id, title, slug, category, description, cover_image_url, card_image_url, card_video_url, view_count")
    .eq("is_featured", true)
    .eq("status", "active")
    .limit(1)
    .single();
  const featuredTopic: Topic | null = featuredData ?? null;

  // Coming Soon topics
  const { data: comingSoonData } = await supabase
    .from("topics")
    .select("id, title, slug, category, description, cover_image_url, card_image_url, card_video_url, view_count")
    .eq("status", "coming_soon")
    .order("created_at", { ascending: false });
  const comingSoonTopics: Topic[] = comingSoonData ?? [];

  // Current user's username + premium status
  let currentUsername: string | null = null;
  let isPremium = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, is_premium")
      .eq("id", user.id)
      .single();
    currentUsername = profile?.username ?? null;
    isPremium = profile?.is_premium ?? false;
  }

  // ── Suggested topics ──────────────────────────────────────────────────────
  const { data: suggestionsRaw, count: suggestionsCount } = await supabase
    .from("topic_suggestions")
    .select("id, title, description, categories, vote_count, user_id, expires_at", { count: "exact" })
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("vote_count", { ascending: false })
    .limit(5);

  const suggestionRows = suggestionsRaw ?? [];
  const submitterIds = [...new Set(suggestionRows.map((s) => s.user_id))];
  let submitterMap: Record<string, { username: string; display_name: string }> = {};
  if (submitterIds.length > 0) {
    const { data: submitters } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", submitterIds);
    (submitters ?? []).forEach((p) => {
      submitterMap[p.id] = { username: p.username, display_name: p.display_name };
    });
  }

  const top5Suggestions: SuggestionRow[] = suggestionRows.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    categories: s.categories,
    vote_count: s.vote_count,
    user_id: s.user_id,
    submitter_username: submitterMap[s.user_id]?.username ?? null,
    submitter_display_name: submitterMap[s.user_id]?.display_name ?? null,
    expires_at: s.expires_at,
  }));
  const totalSuggestionsCount = suggestionsCount ?? top5Suggestions.length;

  // Fetch which suggestions the current user has voted on
  let suggestionVotedIds: string[] = [];
  if (user && top5Suggestions.length > 0) {
    const { data: myVotes } = await supabase
      .from("topic_suggestion_votes")
      .select("suggestion_id")
      .eq("user_id", user.id)
      .in("suggestion_id", top5Suggestions.map((s) => s.id));
    suggestionVotedIds = (myVotes ?? []).map((v) => v.suggestion_id);
  }

  const feedTopics: Topic[] = topics ?? [];
  const topicIds = feedTopics.map((t) => t.id);

  // ── Parallel data fetches ──────────────────────────────────────────────────
  let subjectMap: Record<string, string> = {};
  let attributesByTopic: Record<string, { id: string; name: string }[]> = {};
  let votedTopicIds: Set<string> = new Set();
  let globalTop3ByTopic: Record<string, { name: string; score: number }[]> = {};

  if (topicIds.length > 0) {
    const [subjectsRes, attrsRes, rankingsList] = await Promise.all([
      supabase
        .from("subjects")
        .select("id, topic_id, name")
        .in("topic_id", topicIds),
      supabase
        .from("attributes")
        .select("id, topic_id, name")
        .in("topic_id", topicIds)
        .eq("status", "active"),
      Promise.all(
        feedTopics.map(async (t: Topic) => {
          const { data } = await supabase.rpc("get_global_rankings", {
            p_topic_id: t.id,
          });
          return { topicId: t.id, rankings: (data ?? []) as GlobalRanking[] };
        })
      ),
    ]);

    // Subject id → name map
    (subjectsRes.data ?? []).forEach((s: { id: string; topic_id: string; name: string }) => {
      subjectMap[s.id] = s.name;
    });

    // Attributes grouped by topic
    (attrsRes.data ?? []).forEach((a: { id: string; topic_id: string; name: string }) => {
      if (!attributesByTopic[a.topic_id]) attributesByTopic[a.topic_id] = [];
      attributesByTopic[a.topic_id].push({ id: a.id, name: a.name });
    });

    // Global top 3 per topic
    rankingsList.forEach(({ topicId, rankings }: { topicId: string; rankings: GlobalRanking[] }) => {
      globalTop3ByTopic[topicId] = rankings
        .slice(0, 3)
        .map((r: GlobalRanking) => ({
          name: subjectMap[r.subject_id] ?? "—",
          score: Math.round(r.avg_score),
        }));
    });

    // Current user's voted topics
    if (user) {
      const { data: myLists } = await supabase
        .from("user_lists")
        .select("topic_id")
        .eq("user_id", user.id)
        .in("topic_id", topicIds);
      (myLists ?? []).forEach((r: { topic_id: string }) => votedTopicIds.add(r.topic_id));
    }
  }

  // Trending: topics sorted by view count descending (always from full list)
  const trendingTopics = [...feedTopics]
    .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
    .slice(0, 5);

  // ── Filter by category ───────────────────────────────────────────────────
  let displayTopics = feedTopics;
  if (activeCat !== "all") {
    displayTopics = displayTopics.filter(
      (t) => t.category.some((c) => c.toLowerCase() === activeCat.toLowerCase())
    );
  }

  // ── Filter by browse mode ────────────────────────────────────────────────
  if (activeBrowse === "voted") {
    displayTopics = displayTopics.filter((t) => votedTopicIds.has(t.id));
  }

  // ── Sort ──────────────────────────────────────────────────────────────────
  if (activeSort === "new") {
    // feedTopics already ordered by created_at desc from query — no re-sort needed
  } else if (activeSort === "top") {
    displayTopics = [...displayTopics].sort(
      (a, b) => (b.view_count ?? 0) - (a.view_count ?? 0)
    );
  } else {
    // "hot" — default: keep created_at desc order from query
  }

  // Hero banner topic = featured topic, or fallback to first in display list
  const heroBannerTopic = featuredTopic ?? displayTopics[0] ?? null;

  return (
    <main className="min-h-screen">

      {/* ── Site Hero ── */}
      <section className="relative overflow-hidden border-b border-brand-border">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-accent/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[200px] bg-brand-aura/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 py-14 sm:py-20 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left: headline */}
            <div>
              <h1 className="font-display text-6xl sm:text-8xl leading-[0.85] tracking-wide">
                DEBATE THE GREATS.
                <br />
                <span className="block mt-2">
                  {brandHighlight("CREATE AND SHARE YOUR TOP 5 DOA.", ["TOP", "5"])}
                </span>
              </h1>
              <p className="text-neutral-400 font-body text-lg mt-6 max-w-md leading-relaxed">
                Rank what matters. Score the legends. See how your top 5 stacks up against the world.
              </p>
              <div className="flex items-center gap-3 mt-8">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-surface border border-brand-border text-xs font-mono text-neutral-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
                  {feedTopics.length} active debates
                </span>
              </div>
            </div>

            {/* Right: featured topic card */}
            {heroBannerTopic && (
              <div className="relative rounded-2xl overflow-hidden border border-brand-border aspect-[16/10]">
                {/* Background media */}
                {(() => {
                  const videoId = heroBannerTopic.card_video_url
                    ? extractYouTubeId(heroBannerTopic.card_video_url)
                    : null;
                  if (videoId) {
                    return (
                      <>
                        <div className="absolute inset-0 hidden md:block pointer-events-none">
                          <iframe
                            src={youtubeBackgroundSrc(videoId)}
                            className="absolute inset-0 w-full h-full"
                            style={{ border: 0, transform: "scale(1.5)" }}
                            allow="autoplay; encrypted-media"
                            tabIndex={-1}
                            title="Featured topic background"
                          />
                        </div>
                        {heroBannerTopic.card_image_url && (
                          <img
                            src={heroBannerTopic.card_image_url}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover pointer-events-none md:hidden"
                          />
                        )}
                      </>
                    );
                  }
                  if (heroBannerTopic.cover_image_url || heroBannerTopic.card_image_url) {
                    return (
                      <img
                        src={(heroBannerTopic.cover_image_url ?? heroBannerTopic.card_image_url)!}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                      />
                    );
                  }
                  return (
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-surface to-brand-bg" />
                  );
                })()}
                {/* Dark gradient overlay */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.2) 100%)",
                  }}
                />
                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-6">
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-accent/10 border border-brand-accent/30 text-xs font-mono text-brand-accent">
                      ★ FEATURED
                    </span>
                    {heroBannerTopic.category.map((cat) => {
                      const color = categoryColor(cat);
                      return (
                        <span
                          key={cat}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/40 border border-white/10 text-xs font-mono uppercase tracking-wider"
                          style={{ color }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          {cat}
                        </span>
                      );
                    })}
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl tracking-wide text-white leading-tight mb-4">
                    {brandHighlight(heroBannerTopic.title)}
                  </h2>
                  <Link
                    href={`/topics/${heroBannerTopic.slug}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-accent text-black font-display text-sm tracking-widest hover:bg-brand-accent/90 transition-colors duration-200 self-start"
                  >
                    MAKE YOUR LIST
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Category Nav Bar ── */}
      <nav className="sticky top-16 z-30 border-b border-brand-border bg-brand-bg/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV_TABS.map((tab) => {
              const isActive = activeCat === tab.value;
              return (
                <Link
                  key={tab.value}
                  href={`/?cat=${tab.value}&sort=${activeSort}`}
                  className={`
                    flex-shrink-0 px-4 py-3.5 font-display text-sm tracking-widest
                    border-b-2 -mb-px transition-all duration-200
                    ${isActive
                      ? "text-brand-accent border-brand-accent"
                      : "text-neutral-500 border-transparent hover:text-neutral-200 hover:border-neutral-600"
                    }
                  `}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* ── How It Works (guests only) ── */}
      {!user && (
        <section className="border-b border-brand-border bg-brand-bg">
          <div className="max-w-5xl mx-auto px-4 py-10 sm:py-12">
            <h2 className="font-display text-xs tracking-[0.25em] text-neutral-500 text-center mb-8">
              HOW IT WORKS
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
              {[
                { num: "1", title: "Pick a Debate", desc: "Choose a topic that gets you fired up" },
                { num: "2", title: "Rank & Score", desc: "Rate what matters most, then score every contender" },
                { num: "3", title: "See Your Top 5", desc: "Lock in your list and see how the world voted" },
              ].map((step) => (
                <div key={step.num} className="flex flex-col items-center text-center sm:items-start sm:text-left">
                  <span
                    className="font-display text-3xl leading-none mb-2"
                    style={{ color: "#e8ff00" }}
                  >
                    {step.num}
                  </span>
                  <h3 className="font-display text-sm tracking-widest text-white mb-1">
                    {step.title.toUpperCase()}
                  </h3>
                  <p className="text-sm font-body text-neutral-500 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 3-Column Layout ── */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_240px] gap-6 items-start">

          {/* ── LEFT SIDEBAR ── */}
          <aside className="hidden lg:flex flex-col gap-4 sticky top-[113px]">

            {/* Browse */}
            <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
              <h3 className="font-display text-xs tracking-[0.2em] text-neutral-500 mb-3 px-1">
                BROWSE
              </h3>
              <nav className="flex flex-col gap-0.5">
                {BROWSE_LINKS.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-body text-neutral-400 hover:text-white hover:bg-white/5 transition-all duration-150"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-accent/50 flex-shrink-0" />
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Trending Now */}
            <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
              <h3 className="font-display text-xs tracking-[0.2em] text-neutral-500 mb-3 px-1">
                TRENDING NOW
              </h3>
              {trendingTopics.length > 0 ? (
                <ol className="flex flex-col gap-0.5">
                  {trendingTopics.map((topic, i) => (
                    <li key={topic.id}>
                      <Link
                        href={`/topics/${topic.slug}`}
                        className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-white/5 transition-colors duration-150"
                      >
                        <span className="font-display text-lg leading-none text-neutral-600 w-5 text-right flex-shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-body text-neutral-300 truncate">
                            {topic.title}
                          </p>
                          <p className="text-xs font-mono text-neutral-600 mt-0.5">
                            {formatCount(topic.view_count ?? 0)} views
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs font-mono text-neutral-700 px-2">No debates yet</p>
              )}
            </div>

          </aside>

          {/* ── MAIN FEED ── */}
          <section className="min-w-0">

            {/* Sort Buttons */}
            <div className="flex items-center gap-2 mb-5">
              {SORT_TABS.map((tab) => {
                const isActive = activeSort === tab.value;
                return (
                  <Link
                    key={tab.value}
                    href={`/?cat=${activeCat}&sort=${tab.value}`}
                    className={`
                      px-5 py-2 rounded-lg font-display text-sm tracking-widest transition-all duration-200
                      ${isActive
                        ? "bg-brand-accent text-black"
                        : "bg-brand-surface border border-brand-border text-neutral-400 hover:text-white hover:border-neutral-600"
                      }
                    `}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>

            {displayTopics.length > 0 ? (
              <div className="flex flex-col gap-4">
                {/* Topic cards */}
                {displayTopics.map((topic) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    attributes={attributesByTopic[topic.id] ?? []}
                    hasVoted={votedTopicIds.has(topic.id)}
                    top3={globalTop3ByTopic[topic.id] ?? []}
                    viewCount={topic.view_count ?? 0}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 rounded-2xl border border-brand-border bg-brand-surface">
                <p className="font-display text-2xl text-neutral-600">NO ACTIVE DEBATES YET</p>
                <p className="text-sm text-neutral-600 mt-2 font-body">Check back soon — debates are coming.</p>
              </div>
            )}
          </section>

          {/* ── RIGHT SIDEBAR ── */}
          <aside className="hidden lg:flex flex-col gap-4 sticky top-[113px]">

            {/* Suggest Topic CTA */}
            <SubmitTopicCTA userId={user?.id ?? null} isPremium={isPremium} />

            {/* Suggested Topics */}
            <SuggestedTopicsPanel
              suggestions={top5Suggestions}
              votedIds={suggestionVotedIds}
              userId={user?.id ?? null}
              totalCount={totalSuggestionsCount}
            />

            {/* Coming Soon */}
            {comingSoonTopics.length > 0 && (
              <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
                <h3 className="font-display text-xs tracking-[0.2em] text-neutral-500 mb-3 px-1">
                  COMING SOON
                </h3>
                <div className="flex flex-col gap-2">
                  {comingSoonTopics.map((topic) => (
                    <ComingSoonCard
                      key={topic.id}
                      topic={topic}
                      alertHref={
                        currentUsername
                          ? `/profile/${currentUsername}#alerts`
                          : "/login"
                      }
                    />
                  ))}
                </div>
              </div>
            )}

          </aside>

        </div>
      </div>
    </main>
  );
}
