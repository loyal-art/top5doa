"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SubjectScoreSlider } from "@/components/subject-score-slider";
import { AttributeRanker } from "./attribute-ranker";
import type { Database } from "@/lib/types/database";

type Topic = Database["public"]["Tables"]["topics"]["Row"];
type Subject = Database["public"]["Tables"]["subjects"]["Row"];
type Attribute = Database["public"]["Tables"]["attributes"]["Row"];

interface TopicVotingFlowProps {
  topic: Topic;
  subjects: Subject[];
  attributes: Attribute[];
  weights: number[];
  globalRankings?: { subject: Subject; score: number }[];
}

function imageSearchUrl(topicTitle: string, subjectName: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${topicTitle} ${subjectName}`)}&tbm=isch`;
}

function CameraLink({ topicTitle, subjectName }: { topicTitle: string; subjectName: string }) {
  return (
    <a
      href={imageSearchUrl(topicTitle, subjectName)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Search images"
      className="inline-flex items-center justify-center w-6 h-6 rounded-md text-neutral-600 hover:text-brand-accent hover:bg-brand-accent/10 transition-colors flex-shrink-0"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </a>
  );
}

function SubjectLinks({ subject, topicTitle }: { subject: Subject; topicTitle: string }) {
  return (
    <>
      <CameraLink topicTitle={topicTitle} subjectName={subject.name} />
      {subject.link_photo && (
        <a
          href={subject.link_photo}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="View photo"
          className="inline-flex items-center justify-center w-6 h-6 rounded-md text-neutral-600 hover:text-brand-accent hover:bg-brand-accent/10 transition-colors flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        </a>
      )}
      {subject.link_music && (
        <a
          href={subject.link_music}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Listen to music"
          className="inline-flex items-center justify-center w-6 h-6 rounded-md text-neutral-600 hover:text-brand-accent hover:bg-brand-accent/10 transition-colors flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
          </svg>
        </a>
      )}
      {subject.link_video && (
        <a
          href={subject.link_video}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Watch video"
          className="inline-flex items-center justify-center w-6 h-6 rounded-md text-neutral-600 hover:text-brand-accent hover:bg-brand-accent/10 transition-colors flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
          </svg>
        </a>
      )}
    </>
  );
}

type Step = "rank" | "score" | "results";
type VoteMode = "by-subject" | "by-attribute";

const STEP_META: Record<Step, { num: number; label: string }> = {
  rank: { num: 1, label: "RANK ATTRIBUTES" },
  score: { num: 2, label: "SCORE SUBJECTS" },
  results: { num: 3, label: "YOUR TOP 5" },
};

export function TopicVotingFlow({
  topic,
  subjects,
  attributes,
  weights,
  globalRankings: initialGlobalRankings,
}: TopicVotingFlowProps) {
  // Memoize the Supabase client so its reference stays stable across renders.
  // createBrowserClient returns a new object on every call; if it were called
  // directly in the component body, `supabase` would be a different reference
  // each render, causing fetchGlobalRankings (which lists it as a dep) to be
  // recreated every render, which in turn would make the useEffect fire on
  // every render while step === "results" — an infinite re-fetch loop.
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [userId, setUserId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [step, setStep] = useState<Step>("rank");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentSubjectIdx, setCurrentSubjectIdx] = useState(0);
  const [voteMode, setVoteMode] = useState<VoteMode>("by-subject");
  const [currentAttrIdx, setCurrentAttrIdx] = useState(0);

  // Global community rankings — null = not yet fetched / loading
  const [globalRankings, setGlobalRankings] = useState<
    { subject: Subject; score: number }[] | null
  >(initialGlobalRankings ?? null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  // Attribute ranking: attribute IDs ordered by importance (index 0 = most important)
  const [rankedAttributeIds, setRankedAttributeIds] = useState<string[]>(
    attributes.map((a) => a.id),
  );

  // Subject scores: { [subjectId]: { [attributeId]: score } }
  const [scores, setScores] = useState<Record<string, Record<string, number>>>(
    () => {
      const initial: Record<string, Record<string, number>> = {};
      for (const subject of subjects) {
        initial[subject.id] = {};
        for (const attr of attributes) {
          initial[subject.id][attr.id] = 50;
        }
      }
      return initial;
    },
  );

  // Check auth state
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
      // No user — nothing to load, stop initializing immediately
      if (!user) setInitializing(false);
    });
  }, [supabase]);

  // Fetch community global rankings from the security-definer RPC.
  // Runs whenever the user reaches the results step, and again after saving.
  const fetchGlobalRankings = useCallback(async () => {
    setGlobalLoading(true);
    const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]));
    const { data, error } = await supabase.rpc("get_global_rankings", {
      p_topic_id: topic.id,
    });
    if (error) {
      // Do NOT set globalRankings to [] on error — that would incorrectly
      // display "No community votes yet" when the real problem is a network
      // or database error.  Leave the previous state intact so the UI stays
      // consistent, and surface the error to the console for debugging.
      console.error("[global rankings] RPC error:", error);
    } else {
      const ranked = (data ?? [])
        .map((r) => ({ subject: subjectMap[r.subject_id], score: Number(r.avg_score) }))
        .filter((r): r is { subject: Subject; score: number } => r.subject != null);
      setGlobalRankings(ranked);
    }
    setGlobalLoading(false);
  }, [supabase, topic.id, subjects]);

  // Load existing user data if logged in
  useEffect(() => {
    if (!userId) return;

    async function loadExistingData() {
      // Fetch profile + check for an already-locked list in parallel
      const [{ data: profile }, { data: lockedList }] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, is_premium, premium_expires_at")
          .eq("id", userId!)
          .single(),
        supabase
          .from("user_lists")
          .select("subject_id")
          .eq("user_id", userId!)
          .eq("topic_id", topic.id)
          .limit(1),
      ]);

      console.log("[profile] raw result:", profile);
      setDisplayName(profile?.display_name ?? null);
      setIsPremium(
        profile?.is_premium === true &&
          profile?.premium_expires_at != null &&
          new Date(profile.premium_expires_at) > new Date()
      );

      // Load existing attribute ranks
      const { data: existingRanks } = await supabase
        .from("user_attribute_ranks")
        .select("attribute_id, rank_position")
        .eq("user_id", userId!)
        .eq("topic_id", topic.id)
        .order("rank_position");

      if (existingRanks && existingRanks.length > 0) {
        const ranked = existingRanks.map((r) => r.attribute_id);
        // Add any attributes that might not have been ranked yet
        const remaining = attributes
          .map((a) => a.id)
          .filter((id) => !ranked.includes(id));
        setRankedAttributeIds([...ranked, ...remaining]);
      }

      // Load existing scores
      const { data: existingScores } = await supabase
        .from("user_subject_scores")
        .select("subject_id, attribute_id, score")
        .eq("user_id", userId!)
        .eq("topic_id", topic.id);

      if (existingScores && existingScores.length > 0) {
        setScores((prev) => {
          const updated = { ...prev };
          for (const s of existingScores) {
            if (!updated[s.subject_id]) updated[s.subject_id] = {};
            updated[s.subject_id][s.attribute_id] = s.score;
          }
          return updated;
        });
      }

      // If the user already has a locked list, skip straight to the results screen
      if (lockedList && lockedList.length > 0) {
        setStep("results");
        setSaved(true);
        fetchGlobalRankings();
      }

      setInitializing(false);
    }

    loadExistingData();
  }, [userId, topic.id, supabase, attributes, fetchGlobalRankings]);

  // Compute ranked attribute objects in order
  const rankedAttributes = useMemo(
    () =>
      rankedAttributeIds
        .map((id) => attributes.find((a) => a.id === id))
        .filter((a): a is Attribute => !!a),
    [rankedAttributeIds, attributes],
  );

  const currentSubject = subjects[currentSubjectIdx];
  const currentAttr = rankedAttributes[currentAttrIdx];

  // Calculate weighted score for a single subject
  const calculateSubjectScore = useCallback(
    (subjectId: string) => {
      if (!weights.length || !rankedAttributeIds.length) return 0;
      let total = 0;
      for (let i = 0; i < rankedAttributeIds.length && i < weights.length; i++) {
        const attrId = rankedAttributeIds[i];
        const score = scores[subjectId]?.[attrId] ?? 50;
        total += score * (weights[i] / 100);
      }
      return Math.round(total * 100) / 100;
    },
    [weights, rankedAttributeIds, scores],
  );

  // Generate ranked results
  const results = useMemo(() => {
    return subjects
      .map((s) => ({
        subject: s,
        score: calculateSubjectScore(s.id),
      }))
      .sort((a, b) => b.score - a.score);
  }, [subjects, calculateSubjectScore]);

  // Save all data to Supabase
  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    setSaved(false);

    try {
      // Delete then insert attribute ranks to avoid unique constraint violations
      // on rank_position when the user re-orders attributes between saves.
      await supabase
        .from("user_attribute_ranks")
        .delete()
        .eq("user_id", userId)
        .eq("topic_id", topic.id);

      const rankRows = rankedAttributeIds.map((attrId, idx) => ({
        user_id: userId,
        topic_id: topic.id,
        attribute_id: attrId,
        rank_position: idx + 1,
      }));
      await supabase.from("user_attribute_ranks").insert(rankRows);

      // Upsert subject scores — safe to upsert individually since the only
      // unique key is (user_id, subject_id, attribute_id) with no rank position.
      for (const subjectId of Object.keys(scores)) {
        for (const attrId of Object.keys(scores[subjectId])) {
          await supabase.from("user_subject_scores").upsert(
            {
              user_id: userId,
              topic_id: topic.id,
              subject_id: subjectId,
              attribute_id: attrId,
              score: scores[subjectId][attrId],
            },
            { onConflict: "user_id,subject_id,attribute_id" },
          );
        }
      }

      // Delete then insert user list for the same reason as attribute ranks:
      // re-saves with different orderings would violate UNIQUE(user_id, topic_id, rank_position).
      await supabase
        .from("user_lists")
        .delete()
        .eq("user_id", userId)
        .eq("topic_id", topic.id);

      const listRows = results.map((r, i) => ({
        user_id: userId,
        topic_id: topic.id,
        subject_id: r.subject.id,
        calculated_score: r.score,
        rank_position: i + 1,
      }));
      await supabase.from("user_lists").insert(listRows);

      setSaved(true);
      // Refetch so the community tally reflects this user's new vote
      await fetchGlobalRankings();
    } finally {
      setSaving(false);
    }
  }

  function updateScore(subjectId: string, attributeId: string, value: number) {
    setScores((prev) => ({
      ...prev,
      [subjectId]: {
        ...prev[subjectId],
        [attributeId]: value,
      },
    }));
  }

  if (!attributes.length || !subjects.length) {
    return (
      <div className="text-center py-16 text-neutral-500">
        <p className="font-body">This topic doesn&apos;t have enough data to vote on yet.</p>
      </div>
    );
  }

  if (initializing) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 flex-1 rounded-xl bg-brand-surface border border-brand-border animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-brand-surface border border-brand-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <div className="flex items-center gap-1 sm:gap-2">
        {(["rank", "score", "results"] as const).map((s, i) => {
          const isActive = step === s;
          const isPast =
            (s === "rank" && (step === "score" || step === "results")) ||
            (s === "score" && step === "results");

          return (
            <button
              key={s}
              onClick={() => setStep(s)}
              className="flex items-center gap-2 flex-1 sm:flex-none"
            >
              <div
                className={`flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-xl text-sm font-mono transition-all w-full sm:w-auto justify-center sm:justify-start ${
                  isActive
                    ? "bg-brand-accent text-brand-bg font-bold"
                    : isPast
                      ? "bg-brand-surface border border-brand-accent/30 text-brand-accent"
                      : "bg-brand-surface border border-brand-border text-neutral-500"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isActive
                      ? "bg-brand-bg text-brand-accent"
                      : isPast
                        ? "bg-brand-accent/20 text-brand-accent"
                        : "bg-brand-border text-neutral-600"
                  }`}
                >
                  {isPast ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="hidden sm:inline">{STEP_META[s].label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Step 1: Rank Attributes */}
      {step === "rank" && (
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
              onClick={() => setStep("score")}
              className="px-8 py-3.5 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold
                         hover:bg-brand-accent/90 transition-colors"
            >
              Next: Score Subjects
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Score Subjects */}
      {step === "score" && (
        <div className="space-y-6">
          {/* Mode toggle */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider hidden sm:inline">
              Mode:
            </span>
            <div className="flex items-center p-1 rounded-xl bg-brand-surface border border-brand-border gap-1">
              <button
                onClick={() => setVoteMode("by-subject")}
                className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition-colors ${
                  voteMode === "by-subject"
                    ? "bg-brand-accent text-brand-bg"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                BY SUBJECT
              </button>
              <button
                onClick={() => setVoteMode("by-attribute")}
                className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition-colors ${
                  voteMode === "by-attribute"
                    ? "bg-brand-accent text-brand-bg"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                BY ATTRIBUTE
              </button>
            </div>
            <span className="text-xs font-mono text-neutral-600 hidden sm:inline">
              {voteMode === "by-subject"
                ? "Score all attributes for one subject at a time"
                : "Compare all subjects side-by-side for one attribute"}
            </span>
          </div>

          {/* ── BY SUBJECT mode ── */}
          {voteMode === "by-subject" && currentSubject && (
            <>
              {/* Subject header card */}
              <div className="flex items-center justify-between p-5 rounded-2xl bg-brand-surface border border-brand-border">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-3xl tracking-wide">
                      {currentSubject.name.toUpperCase()}
                    </h2>
                    <SubjectLinks subject={currentSubject} topicTitle={topic.title} />
                  </div>
                  {currentSubject.era && (
                    <p className="text-neutral-500 text-sm font-mono mt-1">{currentSubject.era}</p>
                  )}
                  {currentSubject.description && (
                    <p className="text-sm text-neutral-400 break-words mt-1">{currentSubject.description}</p>
                  )}
                  <p className="text-neutral-600 text-xs font-mono mt-1">
                    Subject {currentSubjectIdx + 1} of {subjects.length}
                  </p>
                </div>

                {/* Subject stats */}
                {currentSubject.stats && (
                  <div className="hidden sm:flex items-center gap-3">
                    {Object.entries(currentSubject.stats as Record<string, number>).slice(0, 4).map(([key, val]) => (
                      <div key={key} className="text-center px-3 py-2 rounded-lg bg-brand-bg border border-brand-border">
                        <p className="text-xs font-mono text-neutral-600 uppercase">{key}</p>
                        <p className="text-sm font-mono font-bold text-white">{val}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Attribute sliders */}
              <div className="space-y-6">
                {rankedAttributes.map((attr, idx) => (
                  <div key={attr.id} className="p-4 rounded-xl bg-brand-surface border border-brand-border space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold font-mono ${
                          idx === 0
                            ? "bg-brand-accent/20 text-brand-accent"
                            : "bg-brand-border text-neutral-500"
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="text-sm font-mono text-neutral-300 uppercase tracking-wider">
                          {attr.name}
                        </span>
                      </label>
                      <span className="text-xs font-mono text-neutral-600">
                        {weights[idx] ?? 0}% weight
                      </span>
                    </div>
                    <SubjectScoreSlider
                      value={scores[currentSubject.id]?.[attr.id] ?? 50}
                      onChange={(v) => updateScore(currentSubject.id, attr.id, v)}
                    />
                  </div>
                ))}
              </div>

              {/* Subject Navigation */}
              <div className="flex items-center justify-between pt-4">
                <button
                  onClick={() => {
                    if (currentSubjectIdx > 0) {
                      setCurrentSubjectIdx(currentSubjectIdx - 1);
                    } else {
                      setStep("rank");
                    }
                  }}
                  className="px-5 py-3 rounded-xl bg-brand-surface border border-brand-border
                             text-neutral-300 font-mono text-sm hover:border-neutral-600 transition-colors"
                >
                  {currentSubjectIdx > 0 ? "Previous" : "Back to Ranking"}
                </button>

                {/* Dot nav */}
                <div className="flex gap-1.5">
                  {subjects.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentSubjectIdx(i)}
                      className={`w-2.5 h-2.5 rounded-full transition-colors ${
                        i === currentSubjectIdx
                          ? "bg-brand-accent"
                          : "bg-brand-border hover:bg-neutral-500"
                      }`}
                      aria-label={`Go to subject ${i + 1}`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => {
                    if (currentSubjectIdx < subjects.length - 1) {
                      setCurrentSubjectIdx(currentSubjectIdx + 1);
                    } else {
                      setStep("results");
                    }
                  }}
                  className="px-5 py-3 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold text-sm
                             hover:bg-brand-accent/90 transition-colors"
                >
                  {currentSubjectIdx < subjects.length - 1 ? "Next Subject" : "See Results"}
                </button>
              </div>
            </>
          )}

          {/* ── BY ATTRIBUTE mode ── */}
          {voteMode === "by-attribute" && currentAttr && (
            <>
              {/* Attribute header card */}
              <div className="p-5 rounded-2xl bg-brand-surface border border-brand-border">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold font-mono flex-shrink-0 ${
                      currentAttrIdx === 0
                        ? "bg-brand-accent/20 text-brand-accent"
                        : "bg-brand-border text-neutral-500"
                    }`}>
                      {currentAttrIdx + 1}
                    </span>
                    <div>
                      <h2 className="font-display text-3xl tracking-wide">
                        {currentAttr.name.toUpperCase()}
                      </h2>
                      {currentAttr.description && (
                        <p className="text-neutral-500 text-sm font-body mt-1 break-words">{currentAttr.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-mono text-neutral-600">
                      Attribute {currentAttrIdx + 1} of {rankedAttributes.length}
                    </p>
                    <p className="text-sm font-mono font-bold text-brand-accent mt-0.5">
                      {weights[currentAttrIdx] ?? 0}% weight
                    </p>
                  </div>
                </div>
              </div>

              {/* All subjects as sliders for this attribute */}
              <div className="space-y-4">
                {subjects.map((subject) => (
                  <div key={subject.id} className="p-4 rounded-xl bg-brand-surface border border-brand-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-mono text-neutral-300 uppercase tracking-wider">
                            {subject.name}
                          </p>
                          <SubjectLinks subject={subject} topicTitle={topic.title} />
                        </div>
                        {subject.era && (
                          <p className="text-xs font-mono text-neutral-600">{subject.era}</p>
                        )}
                        {subject.description && (
                          <p className="text-sm text-neutral-400 break-words mt-0.5">{subject.description}</p>
                        )}
                      </div>
                    </div>
                    <SubjectScoreSlider
                      value={scores[subject.id]?.[currentAttr.id] ?? 50}
                      onChange={(v) => updateScore(subject.id, currentAttr.id, v)}
                    />
                  </div>
                ))}
              </div>

              {/* Attribute Navigation */}
              <div className="flex items-center justify-between pt-4">
                <button
                  onClick={() => {
                    if (currentAttrIdx > 0) {
                      setCurrentAttrIdx(currentAttrIdx - 1);
                    } else {
                      setStep("rank");
                    }
                  }}
                  className="px-5 py-3 rounded-xl bg-brand-surface border border-brand-border
                             text-neutral-300 font-mono text-sm hover:border-neutral-600 transition-colors"
                >
                  {currentAttrIdx > 0 ? "Previous" : "Back to Ranking"}
                </button>

                {/* Dot nav for attributes */}
                <div className="flex gap-1.5">
                  {rankedAttributes.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentAttrIdx(i)}
                      className={`w-2.5 h-2.5 rounded-full transition-colors ${
                        i === currentAttrIdx
                          ? "bg-brand-accent"
                          : "bg-brand-border hover:bg-neutral-500"
                      }`}
                      aria-label={`Go to attribute ${i + 1}`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => {
                    if (currentAttrIdx < rankedAttributes.length - 1) {
                      setCurrentAttrIdx(currentAttrIdx + 1);
                    } else {
                      setStep("results");
                    }
                  }}
                  className="px-5 py-3 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold text-sm
                             hover:bg-brand-accent/90 transition-colors"
                >
                  {currentAttrIdx < rankedAttributes.length - 1 ? "Next Attribute" : "See Results"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 3: Results */}
      {step === "results" && (
        <div className="space-y-6">
          {saved ? (
            /* ── Post-save: two-column locked-in view ── */
            <>
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-3xl tracking-wide">LIST LOCKED IN</h2>
                  <p className="text-neutral-500 text-sm mt-1 font-body">
                    Your vote has been counted
                  </p>
                  <p className="text-xs italic text-neutral-600 mt-1 font-body">
                    Scores reflect ranking within this topic only.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-mono font-bold">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  LOCKED
                </span>
              </div>

              {/* Two-column grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: personal list */}
                <div className="space-y-3">
                  <h3 className="font-display text-lg tracking-wide text-neutral-300">
                    {displayName ? `${displayName}'s List` : "YOUR LIST"}
                  </h3>
                  {(isPremium ? results : results.slice(0, 5)).map((r, idx) => {
                    const isGold = idx === 0;
                    const isSilver = idx === 1;
                    const isBronze = idx === 2;
                    return (
                      <div
                        key={r.subject.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          isGold ? "bg-brand-accent/5 border-brand-accent/40" : "bg-brand-surface border-brand-border"
                        }`}
                      >
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-display text-base flex-shrink-0 ${
                          isGold ? "bg-brand-accent/20 text-brand-accent"
                          : isSilver ? "bg-neutral-400/20 text-neutral-300"
                          : isBronze ? "bg-orange-500/20 text-orange-400"
                          : "bg-brand-border text-neutral-600"
                        }`}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className={`font-display text-sm tracking-wide truncate flex-1 min-w-0 ${isGold ? "text-brand-accent" : "text-white"}`}>
                              {r.subject.name.toUpperCase()}
                            </p>
                            <SubjectLinks subject={r.subject} topicTitle={topic.title} />
                          </div>
                          {r.subject.era && (
                            <p className="text-xs font-mono text-neutral-600">{r.subject.era}</p>
                          )}
                        </div>
                        <p className={`font-mono font-bold text-sm flex-shrink-0 ${isGold ? "text-brand-accent" : "text-neutral-400"}`}>
                          {r.score.toFixed(1)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Right: community tally */}
                <div className="space-y-3">
                  <h3 className="font-display text-lg tracking-wide text-neutral-300">HOW THE WORLD RANKED IT</h3>
                  {globalLoading || globalRankings === null ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-14 rounded-xl bg-brand-surface border border-brand-border animate-pulse" />
                      ))}
                    </div>
                  ) : globalRankings.length === 0 ? (
                    <p className="text-neutral-500 text-sm font-mono py-6 text-center">
                      No community votes yet.<br />You&apos;re among the first!
                    </p>
                  ) : (
                    <>
                      {/* Global #1 — always visible */}
                      {globalRankings[0] && (() => {
                        const r = globalRankings[0];
                        return (
                          <div
                            key={r.subject.id}
                            className="flex items-center gap-3 p-3 rounded-xl border transition-all bg-brand-accent/5 border-brand-accent/40"
                          >
                            <span className="w-8 h-8 rounded-full flex items-center justify-center font-display text-base flex-shrink-0 bg-brand-accent/20 text-brand-accent">
                              1
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <p className="font-display text-sm tracking-wide truncate flex-1 min-w-0 text-brand-accent">
                                  {r.subject.name.toUpperCase()}
                                </p>
                                <SubjectLinks subject={r.subject} topicTitle={topic.title} />
                              </div>
                              {r.subject.era && (
                                <p className="text-xs font-mono text-neutral-600">{r.subject.era}</p>
                              )}
                            </div>
                            <p className="font-mono font-bold text-sm flex-shrink-0 text-brand-accent">
                              {r.score.toFixed(1)}
                            </p>
                          </div>
                        );
                      })()}

                      {/* Global positions 2+: blurred for free users, fully visible for premium */}
                      {globalRankings.slice(1, isPremium ? undefined : 5).length > 0 && (
                        <div className="relative">
                          <div className={!isPremium ? "blur-sm pointer-events-none select-none" : ""}>
                            <div className="space-y-3">
                              {globalRankings.slice(1, isPremium ? undefined : 5).map((r, relIdx) => {
                                const idx = relIdx + 1;
                                const isSilver = idx === 1;
                                const isBronze = idx === 2;
                                return (
                                  <div
                                    key={r.subject.id}
                                    className="flex items-center gap-3 p-3 rounded-xl border transition-all bg-brand-surface border-brand-border"
                                  >
                                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-display text-base flex-shrink-0 ${
                                      isSilver ? "bg-neutral-400/20 text-neutral-300"
                                      : isBronze ? "bg-orange-500/20 text-orange-400"
                                      : "bg-brand-border text-neutral-600"
                                    }`}>
                                      {idx + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <p className="font-display text-sm tracking-wide truncate flex-1 min-w-0 text-white">
                                          {r.subject.name.toUpperCase()}
                                        </p>
                                        <SubjectLinks subject={r.subject} topicTitle={topic.title} />
                                      </div>
                                      {r.subject.era && (
                                        <p className="text-xs font-mono text-neutral-600">{r.subject.era}</p>
                                      )}
                                    </div>
                                    <p className="font-mono font-bold text-sm flex-shrink-0 text-neutral-400">
                                      {r.score.toFixed(1)}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          {!isPremium && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-brand-bg/70">
                              <p className="font-display text-base tracking-wide text-white text-center px-4">
                                Upgrade to see the full rankings
                              </p>
                              <a
                                href="/signup"
                                className="px-6 py-2.5 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold text-sm hover:bg-brand-accent/90 transition-colors"
                              >
                                Unlock Full Rankings
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Edit Vote button */}
              <div className="flex justify-start pt-2">
                <button
                  onClick={() => {
                    setSaved(false);
                    setCurrentSubjectIdx(0);
                    setStep("rank");
                  }}
                  className="px-5 py-3 rounded-xl bg-brand-surface border border-brand-border
                             text-neutral-300 font-mono text-sm hover:border-neutral-600 transition-colors"
                >
                  Edit Vote
                </button>
              </div>
            </>
          ) : (
            /* ── Pre-save: single-column preview ── */
            <>
              <div>
                <h2 className="font-display text-3xl tracking-wide">YOUR TOP 5</h2>
                <p className="text-neutral-500 text-sm mt-1 font-body">
                  Based on your attribute rankings and scores
                </p>
                <p className="text-xs italic text-neutral-600 mt-1 font-body">
                  Scores reflect ranking within this topic only.
                </p>
              </div>

              <div className="space-y-3">
                {/* Position #1 — always visible */}
                {results[0] && (
                  <div className="flex items-center gap-4 p-4 rounded-xl border transition-all bg-brand-accent/5 border-brand-accent/40">
                    <span className="w-10 h-10 rounded-full flex items-center justify-center font-display text-xl flex-shrink-0 bg-brand-accent/20 text-brand-accent">
                      1
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-display text-lg tracking-wide truncate flex-1 min-w-0 text-brand-accent">
                          {results[0].subject.name.toUpperCase()}
                        </p>
                        <SubjectLinks subject={results[0].subject} topicTitle={topic.title} />
                      </div>
                      {results[0].subject.era && (
                        <p className="text-xs font-mono text-neutral-600">{results[0].subject.era}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono font-bold text-lg text-brand-accent">
                        {results[0].score.toFixed(1)}
                      </p>
                      <p className="text-xs font-mono text-neutral-600">pts</p>
                    </div>
                  </div>
                )}

                {/* Positions 2–5: blurred for unauthenticated users */}
                {results.slice(1, 5).length > 0 && (
                  <div className="relative">
                    <div className={!userId ? "blur-sm pointer-events-none select-none" : ""}>
                      <div className="space-y-3">
                        {results.slice(1, 5).map((r, relIdx) => {
                          const idx = relIdx + 1;
                          const isSilver = idx === 1;
                          const isBronze = idx === 2;
                          return (
                            <div
                              key={r.subject.id}
                              className="flex items-center gap-4 p-4 rounded-xl border transition-all bg-brand-surface border-brand-border"
                            >
                              <span className={`w-10 h-10 rounded-full flex items-center justify-center font-display text-xl flex-shrink-0 ${
                                isSilver ? "bg-neutral-400/20 text-neutral-300"
                                : isBronze ? "bg-orange-500/20 text-orange-400"
                                : "bg-brand-border text-neutral-600"
                              }`}>
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <p className="font-display text-lg tracking-wide truncate flex-1 min-w-0 text-white">
                                    {r.subject.name.toUpperCase()}
                                  </p>
                                  <SubjectLinks subject={r.subject} topicTitle={topic.title} />
                                </div>
                                {r.subject.era && (
                                  <p className="text-xs font-mono text-neutral-600">{r.subject.era}</p>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-mono font-bold text-lg text-white">
                                  {r.score.toFixed(1)}
                                </p>
                                <p className="text-xs font-mono text-neutral-600">pts</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {!userId && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-brand-bg/70">
                        <p className="font-display text-lg tracking-wide text-white text-center px-4">
                          Sign in to see your full Top 5
                        </p>
                        <a
                          href="/signup"
                          className="px-6 py-2.5 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold text-sm hover:bg-brand-accent/90 transition-colors"
                        >
                          Sign Up
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4">
                <button
                  onClick={() => {
                    setCurrentSubjectIdx(0);
                    setStep("score");
                  }}
                  className="px-5 py-3 rounded-xl bg-brand-surface border border-brand-border
                             text-neutral-300 font-mono text-sm hover:border-neutral-600 transition-colors"
                >
                  Edit Scores
                </button>

                {userId ? (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-8 py-3.5 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold text-sm
                               hover:bg-brand-accent/90 disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Saving..." : "Lock In My List"}
                  </button>
                ) : (
                  <a
                    href="/login"
                    className="px-8 py-3.5 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold text-sm
                               hover:bg-brand-accent/90 transition-colors inline-block"
                  >
                    Sign In to Save
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
