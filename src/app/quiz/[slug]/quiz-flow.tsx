"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AttributeRanker } from "@/components/attribute-ranker";
import { ArchetypeReveal } from "@/components/archetype-reveal";
import { createClient } from "@/lib/supabase/client";
import { resolveArchetype, saveUserArchetype, type ArchetypeResult, type TopicArchetype } from "@/lib/archetypes";
import { authHref } from "@/lib/auth-next";
import type { Database } from "@/lib/types/database";

type Attribute = Database["public"]["Tables"]["attributes"]["Row"];

interface QuizFlowProps {
  topic: { id: string; slug: string; title: string; isDemo: boolean };
  attributes: Attribute[];
  weights: number[];
  archetypes: TopicArchetype[];
}

type Stage = "rank" | "reveal" | "result";

/** Share URL for a result: archetype id in the path, secondary as `?s=`. */
export function archetypeSharePath(
  topicSlug: string,
  primaryId: string,
  secondaryId?: string | null,
): string {
  const base = `/quiz/${topicSlug}/${primaryId}`;
  return secondaryId ? `${base}?s=${encodeURIComponent(secondaryId)}` : base;
}

/**
 * The demo. Nothing here carries into the real voting flow by design: a
 * visitor who signs up starts fresh. This component only ranks, reveals,
 * and offers the two CTAs.
 */
export function QuizFlow({ topic, attributes, weights, archetypes }: QuizFlowProps) {
  const [rankedAttributeIds, setRankedAttributeIds] = useState<string[]>(
    () => attributes.map((a) => a.id),
  );
  const [stage, setStage] = useState<Stage>("rank");
  const [result, setResult] = useState<ArchetypeResult | null>(null);
  const [copied, setCopied] = useState(false);
  const supabaseRef = useRef(createClient());
  const [userId, setUserId] = useState<string | null>(null);

  // A signed-in visitor gets the result saved exactly as the full flow would.
  useEffect(() => {
    supabaseRef.current.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
  }, []);

  const rankedAttributes = useMemo(
    () =>
      rankedAttributeIds
        .map((id) => attributes.find((a) => a.id === id))
        .filter((a): a is Attribute => a != null),
    [rankedAttributeIds, attributes],
  );

  // Where the primary CTA lands. A demo topic is too small to vote on (the
  // real flow needs five subjects), so it goes to the homepage; a full topic
  // with archetypes goes straight to its voting page.
  const afterAuthPath = topic.isDemo ? "/" : `/topics/${topic.slug}`;

  function handleReveal() {
    const names: Record<string, string> = {};
    for (const a of attributes) names[a.id] = a.name;
    const r = resolveArchetype(rankedAttributeIds, archetypes, names);
    if (!r) return;
    setResult(r);
    setStage("reveal");
    window.scrollTo(0, 0);
    if (userId) void saveUserArchetype(supabaseRef.current, userId, topic.id, r);
  }

  async function handleShare() {
    if (!result) return;
    const url =
      window.location.origin +
      archetypeSharePath(topic.slug, result.primary.id, result.secondary?.id);
    const title = `I'm ${result.primary.name} — ${topic.title}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user cancelled
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }

  if (stage === "rank") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-3xl tracking-wide">RANK THE ATTRIBUTES</h2>
          <p className="text-neutral-500 text-sm mt-1 font-body">
            Drag to reorder by importance. #1 carries the most weight.
          </p>
        </div>

        <AttributeRanker
          attributes={rankedAttributes}
          weights={weights}
          onReorder={setRankedAttributeIds}
        />

        <div className="flex justify-end pt-2">
          <button
            onClick={handleReveal}
            className="px-8 py-3.5 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold
                       hover:bg-brand-accent/90 transition-colors"
          >
            Reveal My Archetype
          </button>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const primaryButton =
    "inline-block w-full sm:w-auto px-8 py-3.5 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold hover:bg-brand-accent/90 transition-colors";

  return (
    <>
      {stage === "reveal" && (
        <ArchetypeReveal
          result={result}
          topicTitle={topic.title}
          autoDismiss={false}
          onDone={() => setStage("result")}
        />
      )}

      <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 sm:p-8 text-center space-y-4">
        <p className="text-5xl">{result.primary.icon}</p>
        <h2 className="font-display text-3xl sm:text-4xl tracking-wide" style={{ color: "#FFD700" }}>
          YOU ARE {result.primary.name.toUpperCase()}
        </h2>
        <p className="text-neutral-300 font-body leading-relaxed max-w-lg mx-auto">
          {result.primary.base_description}
        </p>
        <p className="text-neutral-400 font-body text-sm italic max-w-lg mx-auto">
          {result.dynamicExplanation}
        </p>
        {result.secondaryPhrase && (
          <p className="font-mono text-sm" style={{ color: "#a78bfa" }}>{result.secondaryPhrase}</p>
        )}

        {/* Primary CTA: the conversion moment */}
        <div className="pt-4 space-y-3">
          {userId ? (
            <>
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-500">
                Saved to your profile
              </p>
              <Link href={afterAuthPath} className={primaryButton}>
                {topic.isDemo ? "Pick a real battleground" : "Now prove it — build your Top 5"}
              </Link>
            </>
          ) : (
            <>
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-500">
                That was the warm-up
              </p>
              <Link href={authHref("signup", afterAuthPath)} className={primaryButton}>
                Create an account — build your real Top 5
              </Link>
              <p className="text-neutral-500 text-xs font-body">
                Already have one?{" "}
                <Link href={authHref("login", afterAuthPath)} className="text-brand-accent hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>

        {/* Secondary CTA: share */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-bg border border-brand-border
                       text-neutral-300 font-mono text-sm hover:border-neutral-600 transition-colors"
          >
            {copied ? <span className="text-brand-accent">Link copied!</span> : <span>Share my archetype</span>}
          </button>
        </div>
      </div>
    </>
  );
}
