import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// ─── Constants ────────────────────────────────────────────────────────────────

const NAV_TABS = [
  { label: "ALL", value: "all" },
  { label: "NFL", value: "nfl" },
  { label: "NBA", value: "nba" },
  { label: "MLB", value: "mlb" },
  { label: "MUSIC", value: "music" },
  { label: "MOVIES", value: "movies" },
  { label: "GAMING", value: "gaming" },
  { label: "COMBAT", value: "combat" },
  { label: "CULTURE", value: "culture" },
] as const;

const SORT_TABS = [
  { label: "HOT", value: "hot" },
  { label: "NEW", value: "new" },
  { label: "TOP", value: "top" },
] as const;

const BROWSE_LINKS = [
  { label: "Trending", href: "/?browse=trending" },
  { label: "Featured", href: "/?browse=featured" },
  { label: "New Topics", href: "/?browse=new" },
  { label: "My Voted", href: "/?browse=voted" },
];

const SIDEBAR_CATEGORIES = [
  { label: "NFL", emoji: "🏈" },
  { label: "NBA", emoji: "🏀" },
  { label: "MLB", emoji: "⚾" },
  { label: "Music", emoji: "🎵" },
  { label: "Movies", emoji: "🎬" },
  { label: "Gaming", emoji: "🎮" },
  { label: "Combat", emoji: "🥊" },
  { label: "Culture", emoji: "🌐" },
];

const TRENDING_NOW = [
  { label: "Greatest NBA Player", votes: "2.4k" },
  { label: "Best Hip-Hop Album", votes: "1.8k" },
  { label: "Top NFL QB Ever", votes: "3.1k" },
  { label: "GOAT Footballer", votes: "4.2k" },
  { label: "Best Video Game", votes: "987" },
];

const CATEGORY_ICONS: Record<string, string> = {
  Sports: "trophy",
  Music: "mic",
  Film: "film",
  Gaming: "gamepad",
};

// ─── Category Icon ─────────────────────────────────────────────────────────────

function CategoryIcon({ category }: { category: string }) {
  const icon = CATEGORY_ICONS[category];
  if (icon === "trophy") {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4m-4.5-9.5L7 4h10l-.5 7.5M7 4H4l1 7h2M17 4h3l-1 7h-2" />
      </svg>
    );
  }
  if (icon === "mic") {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zm7 11a7 7 0 01-14 0m7 7v3m-4 0h8" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const activeCat = params.cat ?? "all";
  const activeSort = params.sort ?? "hot";

  const supabase = await createClient();

  const { data: topics } = await supabase
    .from("topics")
    .select("id, title, slug, category, description, cover_image_url")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-brand-border">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-accent/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[200px] bg-brand-aura/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 py-14 sm:py-20 relative">
          <div className="max-w-2xl">
            <h1 className="font-display text-6xl sm:text-8xl leading-[0.85] tracking-wide">
              DEBATE THE
              <br />
              <span className="text-brand-accent">GREATEST</span>
              <br />
              OF ALL TIME
            </h1>
            <p className="text-neutral-400 font-body text-lg mt-6 max-w-md leading-relaxed">
              Rank what matters. Score the legends. See how your top 5 stacks up against the world.
            </p>
            <div className="flex items-center gap-3 mt-8">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-surface border border-brand-border text-xs font-mono text-neutral-400">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
                {topics?.length ?? 0} active debates
              </span>
            </div>
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

            {/* Categories */}
            <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
              <h3 className="font-display text-xs tracking-[0.2em] text-neutral-500 mb-3 px-1">
                CATEGORIES
              </h3>
              <nav className="flex flex-col gap-0.5">
                {SIDEBAR_CATEGORIES.map((cat) => {
                  const isActive = activeCat === cat.label.toLowerCase();
                  return (
                    <Link
                      key={cat.label}
                      href={`/?cat=${cat.label.toLowerCase()}&sort=${activeSort}`}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-body transition-all duration-150
                        ${isActive
                          ? "text-brand-accent bg-brand-accent/5 border border-brand-accent/20"
                          : "text-neutral-400 hover:text-white hover:bg-white/5"
                        }
                      `}
                    >
                      <span className="text-base leading-none">{cat.emoji}</span>
                      {cat.label}
                    </Link>
                  );
                })}
              </nav>
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

            {/* Topic Cards */}
            {topics && topics.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {topics.map((topic) => (
                  <Link
                    key={topic.id}
                    href={`/topics/${topic.slug}`}
                    className="group relative block rounded-2xl border border-brand-border bg-brand-surface hover:border-brand-accent/40 transition-all duration-300 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/0 to-brand-accent/0 group-hover:from-brand-accent/5 group-hover:to-transparent transition-all duration-300 pointer-events-none" />

                    <div className="relative p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-brand-bg border border-brand-border text-xs font-mono text-neutral-400 uppercase tracking-wider">
                          <CategoryIcon category={topic.category} />
                          {topic.category}
                        </span>
                      </div>

                      <h3 className="font-display text-2xl tracking-wide text-white group-hover:text-brand-accent transition-colors duration-300">
                        {topic.title.toUpperCase()}
                      </h3>

                      {topic.description && (
                        <p className="text-sm text-neutral-500 mt-3 line-clamp-2 font-body leading-relaxed">
                          {topic.description}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-5 text-sm font-mono text-brand-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span>Enter debate</span>
                        <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </div>
                    </div>
                  </Link>
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

            {/* Trending Now */}
            <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
              <h3 className="font-display text-xs tracking-[0.2em] text-neutral-500 mb-3 px-1">
                TRENDING NOW
              </h3>
              <ol className="flex flex-col gap-0.5">
                {TRENDING_NOW.map((item, i) => (
                  <li
                    key={item.label}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-white/5 transition-colors duration-150 cursor-pointer"
                  >
                    <span className="font-display text-lg leading-none text-neutral-600 w-5 text-right flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-body text-neutral-300 truncate">{item.label}</p>
                      <p className="text-xs font-mono text-neutral-600 mt-0.5">{item.votes} votes</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Submit Topic CTA — Premium only */}
            <div className="rounded-xl border border-brand-accent/20 bg-brand-surface p-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-brand-accent/5 rounded-full blur-2xl pointer-events-none" />
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-xs font-mono text-brand-accent mb-3">
                ★ PREMIUM
              </span>
              <h3 className="font-display text-xl tracking-wide text-white leading-tight mb-1">
                SUBMIT A TOPIC
              </h3>
              <p className="text-xs font-body text-neutral-500 leading-relaxed mb-4">
                Have a debate worth having? Premium members can submit topics for the community.
              </p>
              <Link
                href="/premium"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-brand-accent text-black text-sm font-display tracking-widest hover:bg-brand-accent/90 transition-colors duration-200"
              >
                UPGRADE TO SUBMIT
              </Link>
            </div>
          </aside>

        </div>
      </div>
    </main>
  );
}
