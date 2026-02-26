"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
}

type Step = "rank" | "score" | "results";

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
}: TopicVotingFlowProps) {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("rank");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentSubjectIdx, setCurrentSubjectIdx] = useState(0);

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
    });
  }, [supabase]);

  // Load existing user data if logged in
  useEffect(() => {
    if (!userId) return;

    async function loadExistingData() {
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
    }

    loadExistingData();
  }, [userId, topic.id, supabase, attributes]);

  // Compute ranked attribute objects in order
  const rankedAttributes = useMemo(
    () =>
      rankedAttributeIds
        .map((id) => attributes.find((a) => a.id === id))
        .filter((a): a is Attribute => !!a),
    [rankedAttributeIds, attributes],
  );

  const currentSubject = subjects[currentSubjectIdx];

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
      // Upsert attribute ranks
      const rankRows = rankedAttributeIds.map((attrId, idx) => ({
        user_id: userId,
        topic_id: topic.id,
        attribute_id: attrId,
        rank_position: idx + 1,
      }));

      for (const row of rankRows) {
        await supabase.from("user_attribute_ranks").upsert(row, {
          onConflict: "user_id,topic_id,attribute_id",
        });
      }

      // Upsert subject scores
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

      // Upsert user list (cached results)
      for (let i = 0; i < results.length; i++) {
        await supabase.from("user_lists").upsert(
          {
            user_id: userId,
            topic_id: topic.id,
            subject_id: results[i].subject.id,
            calculated_score: results[i].score,
            rank_position: i + 1,
          },
          { onConflict: "user_id,topic_id,subject_id" },
        );
      }

      setSaved(true);
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
      {step === "score" && currentSubject && (
        <div className="space-y-6">
          {/* Subject header card */}
          <div className="flex items-center justify-between p-5 rounded-2xl bg-brand-surface border border-brand-border">
            <div>
              <h2 className="font-display text-3xl tracking-wide">
                {currentSubject.name.toUpperCase()}
              </h2>
              {currentSubject.era && (
                <p className="text-neutral-500 text-sm font-mono mt-1">{currentSubject.era}</p>
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
                  onChange={(v) =>
                    updateScore(currentSubject.id, attr.id, v)
                  }
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
              {currentSubjectIdx < subjects.length - 1
                ? "Next Subject"
                : "See Results"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === "results" && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-3xl tracking-wide">YOUR TOP 5</h2>
            <p className="text-neutral-500 text-sm mt-1 font-body">
              Based on your attribute rankings and scores
            </p>
          </div>

          <div className="space-y-3">
            {results.map((r, idx) => {
              const isTop5 = idx < 5;
              const isGold = idx === 0;
              const isSilver = idx === 1;
              const isBronze = idx === 2;

              return (
                <div
                  key={r.subject.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    isGold
                      ? "bg-brand-accent/5 border-brand-accent/40"
                      : isTop5
                        ? "bg-brand-surface border-brand-border"
                        : "bg-brand-bg border-brand-border opacity-50"
                  }`}
                >
                  {/* Rank badge */}
                  <span
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-display text-xl flex-shrink-0 ${
                      isGold
                        ? "bg-brand-accent/20 text-brand-accent"
                        : isSilver
                          ? "bg-neutral-400/20 text-neutral-300"
                          : isBronze
                            ? "bg-orange-500/20 text-orange-400"
                            : "bg-brand-border text-neutral-600"
                    }`}
                  >
                    {idx + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className={`font-display text-lg tracking-wide truncate ${
                      isGold ? "text-brand-accent" : "text-white"
                    }`}>
                      {r.subject.name.toUpperCase()}
                    </p>
                    {r.subject.era && (
                      <p className="text-xs font-mono text-neutral-600">{r.subject.era}</p>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className={`font-mono font-bold text-lg ${
                      isGold ? "text-brand-accent" : "text-white"
                    }`}>
                      {r.score.toFixed(1)}
                    </p>
                    <p className="text-xs font-mono text-neutral-600">pts</p>
                  </div>
                </div>
              );
            })}
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
                className={`px-8 py-3.5 rounded-xl font-mono font-bold text-sm transition-all ${
                  saved
                    ? "bg-green-500/20 border border-green-500/40 text-green-400"
                    : "bg-brand-accent text-brand-bg hover:bg-brand-accent/90 disabled:opacity-50"
                }`}
              >
                {saving ? "Saving..." : saved ? "Locked In" : "Lock In My List"}
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
        </div>
      )}
    </div>
  );
}
