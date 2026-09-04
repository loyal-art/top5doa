import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { fetchTopicArchetypes } from "@/lib/archetypes";
import { socialMetadata, isAbsoluteHttpUrl } from "@/lib/site";
import { brandHighlight } from "@/lib/utils";
import { QuizFlow } from "./quiz-flow";

interface QuizPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: QuizPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const supabase = await createClient();
    const { data: topic } = await supabase
      .from("topics")
      .select("title, cover_image_url, card_image_url")
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();
    if (!topic) return { title: "Quiz Not Found | Top5DOA" };

    const art = [topic.cover_image_url, topic.card_image_url].find(isAbsoluteHttpUrl);
    return socialMetadata({
      title: `What kind of ${topic.title} fan are you? | Top5DOA`,
      description: "Rank what matters to you and find out your fan archetype in fifteen seconds.",
      path: `/quiz/${slug}`,
      image: art,
      imageAlt: topic.title,
    });
  } catch {
    return { title: "Top5DOA" };
  }
}

/**
 * Anonymous-first archetype quiz. Everything this reads carries a public
 * SELECT policy, so there is no auth check here by design.
 */
export default async function QuizPage({ params }: QuizPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: topic } = await supabase
    .from("topics")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!topic) notFound();

  const archetypes = await fetchTopicArchetypes(supabase, topic.id);
  // A topic with no archetypes has no result to reveal — treat as missing.
  if (archetypes.length === 0) notFound();

  const { data: attributes } = await supabase
    .from("attributes")
    .select("*")
    .eq("topic_id", topic.id)
    .in("status", ["active", "approved"])
    .order("created_at");
  if (!attributes || attributes.length === 0) notFound();

  const { data: scoringConfig } = await supabase
    .from("scoring_configs")
    .select("weights")
    .eq("attribute_count", attributes.length)
    .eq("active", true)
    .maybeSingle();

  return (
    <main className="min-h-screen">
      <section className="border-b border-brand-border">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-600 mb-4">
            <Link href="/" className="hover:text-brand-accent transition-colors">Home</Link>
            <span>/</span>
            <span className="text-neutral-500 uppercase">Quiz</span>
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-brand-accent mb-3">
            What kind of fan are you?
          </p>
          <h1 className="font-display text-4xl sm:text-5xl tracking-wide text-white">
            {brandHighlight(topic.title)}
          </h1>
          <p className="text-neutral-400 mt-3 max-w-2xl font-body leading-relaxed">
            Rank what matters most to you. Fifteen seconds, no account needed.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-8">
        <QuizFlow
          topic={{ id: topic.id, slug: topic.slug, title: topic.title, isDemo: topic.is_demo === true }}
          attributes={attributes}
          weights={(scoringConfig?.weights as number[] | undefined) ?? []}
          archetypes={archetypes}
        />
      </section>
    </main>
  );
}
