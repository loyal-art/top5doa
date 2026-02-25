import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { TopicVotingFlow } from "./topic-voting-flow";

interface TopicPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: TopicPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: topic } = await supabase
    .from("topics")
    .select("title, description")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (!topic) return { title: "Topic Not Found | Top5DOA" };

  return {
    title: `${topic.title} | Top5DOA`,
    description: topic.description,
  };
}

export default async function TopicPage({ params }: TopicPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // Fetch topic
  const { data: topic } = await supabase
    .from("topics")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (!topic) notFound();

  // Fetch subjects for this topic
  const { data: subjects } = await supabase
    .from("subjects")
    .select("*")
    .eq("topic_id", topic.id)
    .order("name");

  // Fetch active attributes for this topic
  const { data: attributes } = await supabase
    .from("attributes")
    .select("*")
    .eq("topic_id", topic.id)
    .in("status", ["active", "approved"])
    .order("created_at");

  // Fetch scoring config for this attribute count
  const attrCount = attributes?.length ?? 0;
  const { data: scoringConfig } = await supabase
    .from("scoring_configs")
    .select("*")
    .eq("attribute_count", attrCount)
    .eq("active", true)
    .single();

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {/* Topic Header */}
      <div className="mb-8">
        <p className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-1">
          {topic.category}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{topic.title}</h1>
        {topic.description && (
          <p className="text-neutral-400 mt-2 max-w-2xl">
            {topic.description}
          </p>
        )}
      </div>

      <TopicVotingFlow
        topic={topic}
        subjects={subjects ?? []}
        attributes={attributes ?? []}
        weights={
          scoringConfig
            ? (scoringConfig.weights as number[])
            : []
        }
      />
    </main>
  );
}
