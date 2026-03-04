import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

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

export async function generateMetadata({ params }: PageProps) {
  const { username, topicSlug } = await params;
  const supabase = await createClient();

  const [{ data: profile }, { data: topic }] = await Promise.all([
    supabase.from("profiles").select("display_name, username").eq("username", username).single(),
    supabase.from("topics").select("title").eq("slug", topicSlug).single(),
  ]);

  if (!profile || !topic) return { title: "List Not Found | Top5DOA" };

  const name = profile.display_name ?? profile.username;
  return {
    title: `${name}'s Top 5: ${topic.title} | Top5DOA`,
    description: `See ${name}'s personal Top 5 ranking for ${topic.title} on Top5DOA.`,
  };
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

  const accent = categoryColor(topic.category);
  const displayName = profile.display_name ?? profile.username;
  const initials = displayName.slice(0, 2).toUpperCase();

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
            {topic.category}
          </span>
          <h1 className="font-display text-3xl sm:text-4xl tracking-wide text-white leading-tight mt-1 break-words">
            {topic.title.toUpperCase()}
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

        {/* Ranked list */}
        <div className="flex flex-col gap-2.5">
          {listEntries && listEntries.length > 0 ? (
            listEntries.map((entry, i) => {
              const rank = RANK_COLORS[i] ?? RANK_COLORS[4];
              // subjects is a joined object from the select
              const subjectName =
                (entry.subjects as { name: string } | null)?.name ?? "Unknown";

              return (
                <div
                  key={entry.subject_id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-brand-border bg-brand-surface"
                >
                  {/* Rank badge */}
                  <span
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-display text-lg flex-shrink-0 ${rank.bg} ${rank.text}`}
                  >
                    {entry.rank_position}
                  </span>

                  {/* Subject name */}
                  <span className="font-body text-white flex-1 min-w-0 break-words">
                    {subjectName}
                  </span>

                  {/* Score */}
                  <span className="text-sm font-mono font-bold flex-shrink-0" style={{ color: accent }}>
                    {Number(entry.calculated_score).toFixed(1)}
                  </span>
                </div>
              );
            })
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
