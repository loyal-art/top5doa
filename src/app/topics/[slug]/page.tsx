import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { TopicVotingFlow } from "./topic-voting-flow";
import { ShareButton } from "@/components/share-button";
import { ViewCounter } from "./view-counter";
import { ScrollToTop } from "./scroll-to-top";
import { WatchVideoButton } from "./watch-video-button";
import { extractYouTubeId, youtubeBackgroundSrc, youtubePipSrc } from "@/lib/youtube";
import { brandHighlight } from "@/lib/utils";
import type { Metadata } from "next";
import { socialMetadata, isAbsoluteHttpUrl, SITE_DESCRIPTION } from "@/lib/site";

interface TopicPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const { slug } = await params;

  // Crawlers time out fast, and metadata must never throw — a failed lookup
  // falls back to the site defaults rather than breaking the page.
  try {
    const supabase = await createClient();
    const { data: topic } = await supabase
      .from("topics")
      .select("title, description, cover_image_url, card_image_url")
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();

    if (!topic) return { title: "Topic Not Found | Top5DOA" };

    // Prefer the wide cover over the card thumbnail; both are optional, and
    // both are hotlinked third-party URLs of unknown size, so no dimensions
    // are declared. Anything non-absolute falls through to the static image.
    const art = [topic.cover_image_url, topic.card_image_url].find(isAbsoluteHttpUrl);

    return socialMetadata({
      title: `${topic.title} | Top5DOA`,
      description: topic.description ?? SITE_DESCRIPTION,
      path: `/topics/${slug}`,
      image: art,
      imageAlt: topic.title,
    });
  } catch {
    return { title: "Top5DOA", description: SITE_DESCRIPTION };
  }
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

  // Fetch subjects for this topic (sort_order first, then creation order as tiebreaker)
  const { data: subjects } = await supabase
    .from("subjects")
    .select("*")
    .eq("topic_id", topic.id)
    .order("sort_order")
    .order("created_at");

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

  // Fetch community global rankings via security-definer RPC
  const { data: globalRankingsData } = await supabase.rpc("get_global_rankings", {
    p_topic_id: topic.id,
  });

  // Voter count — distinct users who have locked in a list for this topic
  const { data: voterRows } = await supabase
    .from("user_lists")
    .select("user_id")
    .eq("topic_id", topic.id);
  const voterCount = new Set((voterRows ?? []).map((r) => r.user_id)).size;

  // Fetch creator username
  let creatorUsername: string | null = null;
  if (topic.created_by) {
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", topic.created_by)
      .single();
    creatorUsername = creatorProfile?.username ?? null;
  }

  const subjectMap = Object.fromEntries((subjects ?? []).map((s) => [s.id, s]));
  const globalRankings = (globalRankingsData ?? [])
    .map((r) => ({ subject: subjectMap[r.subject_id], score: Number(r.avg_score) }))
    .filter((r) => r.subject != null);

  return (
    <main className="min-h-screen">
      <ViewCounter topicId={topic.id} />
      <ScrollToTop />
      {/* Topic Header */}
      <section className="relative border-b border-brand-border overflow-hidden">
        {(() => {
          const videoId = topic.video_url ? extractYouTubeId(topic.video_url) : null;
          if (videoId) {
            return (
              <>
                <iframe
                  src={youtubeBackgroundSrc(videoId)}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{ border: 0, objectFit: "cover", transform: "scale(1.5)" }}
                  allow="autoplay; encrypted-media"
                  tabIndex={-1}
                  title="Background video"
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(to right, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.4) 100%)" }}
                />
              </>
            );
          }
          if (topic.cover_image_url) {
            return (
              <>
                <img
                  src={topic.cover_image_url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(to right, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.4) 100%)" }}
                />
              </>
            );
          }
          return (
            <div className="absolute inset-0 bg-gradient-to-b from-brand-accent/3 to-transparent pointer-events-none" />
          );
        })()}

        <div className="max-w-6xl mx-auto px-4 py-10 relative">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-600 mb-4">
            <Link href="/" className="hover:text-brand-accent transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-neutral-500 uppercase">{topic.category.join(" / ")}</span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl tracking-wide text-white">
            {brandHighlight(topic.title)}
          </h1>
          {topic.description && (
            <p className="text-neutral-400 mt-3 max-w-2xl font-body leading-relaxed break-words">
              {topic.description}
            </p>
          )}
          {creatorUsername && (
            <p className="text-xs font-mono text-neutral-600 mt-2">
              Created by{" "}
              <Link href={`/profile/${creatorUsername}`} className="text-neutral-500 hover:text-brand-accent transition-colors">
                @{creatorUsername}
              </Link>
            </p>
          )}
          <p className="text-xs italic text-neutral-600 mt-1.5 font-body">
            Scores reflect ranking within this topic only.
          </p>

          {/* Stats bar */}
          <div className="flex items-center gap-4 mt-6">
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-neutral-500">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-accent" />
              {subjects?.length ?? 0} subjects
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-neutral-500">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-aura" />
              {attrCount} attributes
            </span>
            <ShareButton title={topic.title} path={`/topics/${slug}`} />
            {(() => {
              const videoId = topic.video_url ? extractYouTubeId(topic.video_url) : null;
              if (!videoId) return null;
              return <WatchVideoButton embedUrl={youtubePipSrc(videoId)} />;
            })()}
          </div>
        </div>
      </section>

      {/* Voting Flow */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        <TopicVotingFlow
          topic={topic}
          subjects={subjects ?? []}
          attributes={attributes ?? []}
          weights={
            scoringConfig
              ? (scoringConfig.weights as number[])
              : []
          }
          globalRankings={globalRankings}
          voterCount={voterCount}
          creatorUsername={creatorUsername}
        />
      </section>
    </main>
  );
}
