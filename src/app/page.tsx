import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const CATEGORY_ICONS: Record<string, string> = {
  Sports: "trophy",
  Music: "mic",
  Film: "film",
  Gaming: "gamepad",
};

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

export default async function Home() {
  const supabase = await createClient();

  const { data: topics } = await supabase
    .from("topics")
    .select("id, title, slug, category, description, cover_image_url")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-brand-border">
        {/* Glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-accent/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[200px] bg-brand-aura/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 py-20 sm:py-28 relative">
          <div className="max-w-2xl">
            <h1 className="font-display text-6xl sm:text-8xl leading-[0.85] tracking-wide">
              DEBATE THE
              <br />
              <span className="text-brand-accent">GREATEST</span>
              <br />
              OF ALL TIME
            </h1>
            <p className="text-neutral-400 font-body text-lg mt-6 max-w-md leading-relaxed">
              Rank what matters. Score the legends. See how your top 5 stacks
              up against the world.
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

      {/* Topic Feed */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="font-display text-3xl tracking-wide text-neutral-300 mb-8">
          ACTIVE DEBATES
        </h2>

        {topics && topics.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {topics.map((topic) => (
              <Link
                key={topic.id}
                href={`/topics/${topic.slug}`}
                className="group relative block rounded-2xl border border-brand-border bg-brand-surface
                           hover:border-brand-accent/40 transition-all duration-300 overflow-hidden"
              >
                {/* Hover glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/0 to-brand-accent/0 group-hover:from-brand-accent/5 group-hover:to-transparent transition-all duration-300 pointer-events-none" />

                <div className="relative p-6 sm:p-8">
                  {/* Category tag */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-brand-bg border border-brand-border text-xs font-mono text-neutral-400 uppercase tracking-wider">
                      <CategoryIcon category={topic.category} />
                      {topic.category}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-display text-2xl sm:text-3xl tracking-wide text-white group-hover:text-brand-accent transition-colors duration-300">
                    {topic.title.toUpperCase()}
                  </h3>

                  {/* Description */}
                  {topic.description && (
                    <p className="text-sm text-neutral-500 mt-3 line-clamp-2 font-body leading-relaxed">
                      {topic.description}
                    </p>
                  )}

                  {/* CTA */}
                  <div className="flex items-center gap-2 mt-6 text-sm font-mono text-brand-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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
    </main>
  );
}
