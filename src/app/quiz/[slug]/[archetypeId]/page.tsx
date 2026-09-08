import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { socialMetadata, isAbsoluteHttpUrl } from "@/lib/site";
import { brandHighlight } from "@/lib/utils";

interface SharePageProps {
  params: Promise<{ slug: string; archetypeId: string }>;
  searchParams: Promise<{ s?: string | string[] }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Load the topic + primary archetype (+ optional secondary) for a share URL.
 * An anonymous result has no row, so the URL is the whole record: the
 * archetype id in the path, the secondary in `?s=`. Every read here is public.
 */
async function loadShare(slug: string, archetypeId: string, secondaryRaw: string | undefined) {
  if (!UUID_RE.test(archetypeId)) return null;
  const supabase = await createClient();

  const { data: topic } = await supabase
    .from("topics")
    .select("id, title, slug, description, cover_image_url, card_image_url")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!topic) return null;

  const { data: primary } = await supabase
    .from("topic_archetypes")
    .select("id, name, base_description, icon")
    .eq("id", archetypeId)
    .eq("topic_id", topic.id)
    .maybeSingle();
  if (!primary) return null;

  let secondary: { name: string } | null = null;
  if (secondaryRaw && UUID_RE.test(secondaryRaw) && secondaryRaw !== archetypeId) {
    const { data } = await supabase
      .from("topic_archetypes")
      .select("name")
      .eq("id", secondaryRaw)
      .eq("topic_id", topic.id)
      .maybeSingle();
    secondary = data ?? null;
  }

  return { topic, primary, secondary };
}

function firstParam(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export async function generateMetadata({ params, searchParams }: SharePageProps): Promise<Metadata> {
  const { slug, archetypeId } = await params;
  const { s } = await searchParams;
  try {
    const share = await loadShare(slug, archetypeId, firstParam(s));
    if (!share) return { title: "Archetype Not Found | Top5DOA" };

    const { topic, primary } = share;
    const art = [topic.cover_image_url, topic.card_image_url].find(isAbsoluteHttpUrl);
    return socialMetadata({
      title: `I'm ${primary.name} — ${topic.title} | Top5DOA`,
      description: `${primary.base_description} What kind of fan are you? Find out in fifteen seconds.`,
      path: `/quiz/${slug}/${primary.id}`,
      image: art,
      imageAlt: `${primary.name} — ${topic.title}`,
    });
  } catch {
    return { title: "Top5DOA" };
  }
}

export default async function ArchetypeSharePage({ params, searchParams }: SharePageProps) {
  const { slug, archetypeId } = await params;
  const { s } = await searchParams;
  const share = await loadShare(slug, archetypeId, firstParam(s));
  if (!share) notFound();

  const { topic, primary, secondary } = share;

  return (
    <main className="min-h-screen">
      <section className="border-b border-brand-border">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-600 mb-4">
            <Link href="/" className="hover:text-brand-accent transition-colors">Home</Link>
            <span>/</span>
            <Link href={`/quiz/${topic.slug}`} className="hover:text-brand-accent transition-colors uppercase">Quiz</Link>
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-neutral-500">
            When it comes to
          </p>
          <h1 className="font-display text-3xl sm:text-4xl tracking-wide text-white mt-2">
            {brandHighlight(topic.title)}
          </h1>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 sm:p-8 text-center space-y-4">
          <p className="text-5xl">{primary.icon}</p>
          <h2 className="font-display text-3xl sm:text-4xl tracking-wide archetype-glow" style={{ color: "#FFD700" }}>
            I&apos;M {primary.name.toUpperCase()}
          </h2>
          <p className="text-neutral-300 font-body leading-relaxed max-w-lg mx-auto">
            {primary.base_description}
          </p>
          {secondary && (
            <p className="font-mono text-sm" style={{ color: "#a78bfa" }}>
              With a touch of {secondary.name}.
            </p>
          )}

          <div className="pt-4 space-y-3">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-500">
              What kind of fan are you?
            </p>
            <Link
              href={`/quiz/${topic.slug}`}
              className="inline-block w-full sm:w-auto px-8 py-3.5 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold
                         hover:bg-brand-accent/90 transition-colors"
            >
              Find out yours — 15 seconds
            </Link>
            <p className="text-neutral-500 text-xs font-body">No account needed.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
