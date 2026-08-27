import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { brandHighlight } from "@/lib/utils";
import type { Metadata } from "next";
import { socialMetadata, isAbsoluteHttpUrl, SITE_DESCRIPTION } from "@/lib/site";
import { SpoilerGate } from "@/components/spoiler-gate";

interface PageProps {
  params: Promise<{ username: string; topicSlug: string }>;
}

const CATEGORY_COLOR: Record<string, string> = {
  nfl: "#4ade80",
  nba: "#60a5fa",
  mlb: "#f97316",
  music: "#a78bfa",
  movies: "#f472b6",
  gaming: "#34d399",
  combat: "#ef4444",
  culture: "#fbbf24",
};

function categoryColor(cat: string) {
  return CATEGORY_COLOR[cat?.toLowerCase()] ?? "#e8ff00";
}

const RANK_COLORS = [
  { bg: "bg-brand-accent/20", text: "text-brand-accent" },
  { bg: "bg-violet-500/20", text: "text-violet-400" },
  { bg: "bg-orange-500/20", text: "text-orange-400" },
  { bg: "bg-brand-border", text: "text-neutral-500" },
  { bg: "bg-brand-border", text: "text-neutral-500" },
];

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username, topicSlug } = await params;

  // Must stay fast and must never throw: this runs for social crawlers, which
  // give up quickly. Two indexed lookups, then one more for the poster. It
  // never generates a poster or calls an AI API — it only reads what exists.
  try {
    const supabase = await createClient();

    const [{ data: profile }, { data: topic }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, username")
        .eq("username", username)
        .maybeSingle(),
      supabase.from("topics").select("id, title").eq("slug", topicSlug).maybeSingle(),
    ]);

    if (!profile || !topic) return { title: "List Not Found | Top5DOA" };

    const name = profile.display_name ?? profile.username;
    const title = `${name}'s Top 5: ${topic.title} | Top5DOA`;
    const description = `See ${name}'s personal Top 5 ranking for ${topic.title} on Top5DOA.`;

    // The user's saved poster is the whole point of the share preview. Legacy
    // base64 rows are not absolute URLs, so they fall through to the static
    // image rather than emitting a multi-megabyte data: URI into a meta tag.
    const { data: poster } = await supabase
      .from("poster_images")
      .select("image_data")
      .eq("user_id", profile.id)
      .eq("topic_id", topic.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const posterUrl = isAbsoluteHttpUrl(poster?.image_data) ? poster.image_data : null;

    return socialMetadata({
      title,
      description,
      path: `/list/${username}/${topicSlug}`,
      image: posterUrl,
      // Posters are composited at a fixed 1080x1080.
      imageWidth: posterUrl ? 1080 : undefined,
      imageHeight: posterUrl ? 1080 : undefined,
      imageAlt: `${name}'s Top 5 for ${topic.title}`,
      type: "article",
    });
  } catch {
    return { title: "Top5DOA", description: SITE_DESCRIPTION };
  }
}

export default async function SharedListPage({ params }: PageProps) {
  const { username, topicSlug } = await params;
  const supabase = await createClient();

  // Look up profile by username
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  // Look up topic by slug
  const { data: topic } = await supabase
    .from("topics")
    .select("id, title, slug, category")
    .eq("slug", topicSlug)
    .single();

  if (!topic) notFound();

  // Fetch the user's ranked list, joining subject names
  const { data: listEntries } = await supabase
    .from("user_lists")
    .select("rank_position, calculated_score, subject_id, subjects(name)")
    .eq("user_id", profile.id)
    .eq("topic_id", topic.id)
    .order("rank_position")
    .limit(5);

  // ── Viewer + spoiler gate ────────────────────────────────────────────────
  // Logged-out visitors see the archetype and the #1 pick; 2-5 are blurred.
  // Anyone signed in sees the full list, and the owner always sees everything.
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  const isOwner = viewer?.id === profile.id;
  const locked = !viewer && !isOwner;

  // ── Archetype (revealed even when gated — it is the identity hook) ───────
  let archetype: { name: string; base_description: string; icon: string } | null = null;
  const { data: userArchetype } = await supabase
    .from("user_archetypes")
    .select("primary_archetype_id")
    .eq("user_id", profile.id)
    .eq("topic_id", topic.id)
    .maybeSingle();

  if (userArchetype?.primary_archetype_id) {
    const { data: archetypeRow } = await supabase
      .from("topic_archetypes")
      .select("name, base_description, icon")
      .eq("id", userArchetype.primary_archetype_id)
      .maybeSingle();
    archetype = archetypeRow ?? null;
  }

  const accent = categoryColor(topic.category?.[0] ?? "");
  const displayName = profile.display_name ?? profile.username;
  const initials = displayName.slice(0, 2).toUpperCase();

  const entries = listEntries ?? [];
  const topPick = entries[0];
  const restPicks = entries.slice(1);

  const renderEntry = (
    entry: (typeof entries)[number],
    index: number,
  ) => {
    const rank = RANK_COLORS[index] ?? RANK_COLORS[4];
    const subjectName =
      (entry.subjects as unknown as { name: string } | null)?.name ?? "Unknown";

    return (
      <div
        key={entry.subject_id}
        className="flex items-center gap-4 p-4 rounded-xl border border-brand-border bg-brand-surface"
      >
        <span
          className={`w-9 h-9 rounded-full flex items-center justify-center font-display text-lg flex-shrink-0 ${rank.bg} ${rank.text}`}
        >
          {entry.rank_position}
        </span>
        <span className="font-body text-white flex-1 min-w-0 break-words">
          {subjectName}
        </span>
        <span className="text-sm font-mono font-bold flex-shrink-0" style={{ color: accent }}>
          {Number(entry.calculated_score).toFixed(1)}
        </span>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-brand-bg">
      {/* Category accent line */}
      <div className="w-full h-1" style={{ backgroundColor: accent }} />

      <div className="max-w-lg mx-auto px-4 py-10 flex flex-col gap-8">

        {/* Back link */}
        <Link
          href={`/topics/${topicSlug}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-neutral-600 hover:text-neutral-400 transition-colors w-fit"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          BACK TO TOPIC
        </Link>

        {/* Topic heading */}
        <div>
          <span
            className="text-xs font-mono uppercase tracking-widest"
            style={{ color: accent }}
          >
            {topic.category?.join(" / ")}
          </span>
          <h1 className="font-display text-3xl sm:text-4xl tracking-wide text-white leading-tight mt-1 break-words">
            {brandHighlight(topic.title)}
          </h1>
        </div>

        {/* User identity card */}
        <div className="flex items-center gap-4 p-4 rounded-xl border border-brand-border bg-brand-surface">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={profile.username}
              className="w-12 h-12 rounded-full object-cover border border-brand-border flex-shrink-0"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center font-display text-lg flex-shrink-0 border border-brand-border"
              style={{ backgroundColor: `${accent}22`, color: accent }}
            >
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display text-lg tracking-wide text-white truncate">
              {displayName.toUpperCase()}
            </p>
            <p className="text-xs font-mono text-neutral-600 mt-0.5">
              @{profile.username}
            </p>
          </div>
          <span
            className="ml-auto flex-shrink-0 text-xs font-mono px-2.5 py-0.5 rounded-full border"
            style={{
              color: accent,
              borderColor: `${accent}40`,
              backgroundColor: `${accent}15`,
            }}
          >
            TOP 5
          </span>
        </div>

        {/* Archetype — always fully revealed, gated or not */}
        {archetype && (
          <div className="flex items-start gap-4 p-4 rounded-xl border border-brand-border bg-brand-surface">
            <span className="text-3xl leading-none flex-shrink-0" aria-hidden="true">
              {archetype.icon}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-600">
                Ranking Archetype
              </p>
              <p className="font-display text-xl tracking-wide mt-0.5" style={{ color: accent }}>
                {archetype.name.toUpperCase()}
              </p>
              <p className="font-body text-sm text-neutral-400 mt-1 leading-snug">
                {archetype.base_description}
              </p>
            </div>
          </div>
        )}

        {/* Ranked list */}
        <div className="flex flex-col gap-2.5">
          {entries.length > 0 ? (
            <>
              {/* #1 pick — always visible, it is the hook */}
              {topPick && renderEntry(topPick, 0)}

              {/* Positions 2-5 — blurred for logged-out visitors */}
              {restPicks.length > 0 && (
                <SpoilerGate
                  locked={locked}
                  message={`Build your own Top 5 to see the rest of ${displayName}'s list`}
                  ctaLabel="Build Your List"
                  ctaHref={`/topics/${topicSlug}`}
                >
                  <div className="flex flex-col gap-2.5">
                    {restPicks.map((entry, i) => renderEntry(entry, i + 1))}
                  </div>
                </SpoilerGate>
              )}
            </>
          ) : (
            <div className="text-center py-16 border border-brand-border rounded-xl bg-brand-surface">
              <p className="text-neutral-600 font-mono text-sm">No list found for this topic.</p>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-3 pt-2">
          <Link
            href={`/topics/${topicSlug}`}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-display tracking-widest text-sm uppercase transition-all duration-200 hover:opacity-90"
            style={{
              backgroundColor: `${accent}18`,
              border: `1px solid ${accent}50`,
              color: accent,
            }}
          >
            Make Your Own List
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <p className="text-xs font-mono text-neutral-700">Top5DOA — Rank Everything</p>
        </div>

      </div>
    </main>
  );
}
