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
        <p>This topic doesn&apos;t have enough data to vote on yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {(["rank", "score", "results"] as const).map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              step === s
                ? "bg-white text-neutral-900"
                : "bg-neutral-900 text-neutral-400 hover:text-white"
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-800 text-neutral-500"
              }`}
            >
              {i + 1}
            </span>
            {s === "rank" && "Rank Attributes"}
            {s === "score" && "Score Subjects"}
            {s === "results" && "Your Top 5"}
          </button>
        ))}
      </div>

      {/* Step 1: Rank Attributes */}
      {step === "rank" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold">Rank the Attributes</h2>
            <p className="text-neutral-500 text-sm mt-1">
              Drag to reorder by importance. #1 carries the most weight.
            </p>
          </div>

          <AttributeRanker
            attributes={rankedAttributes}
            weights={weights}
            onReorder={setRankedAttributeIds}
          />

          <div className="flex justify-end">
            <button
              onClick={() => setStep("score")}
              className="px-6 py-3 rounded-lg bg-white text-neutral-900 font-semibold
                         hover:bg-neutral-200 transition-colors"
            >
              Next: Score Subjects
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Score Subjects */}
      {step === "score" && currentSubject && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">
                Rate: {currentSubject.name}
              </h2>
              {currentSubject.era && (
                <p className="text-neutral-500 text-sm">{currentSubject.era}</p>
              )}
              <p className="text-neutral-600 text-xs mt-1">
                Subject {currentSubjectIdx + 1} of {subjects.length}
              </p>
            </div>
            {currentSubject.photo_url && (
              <div className="w-16 h-16 rounded-full bg-neutral-800 overflow-hidden flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentSubject.photo_url}
                  alt={currentSubject.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          <div className="space-y-8">
            {rankedAttributes.map((attr, idx) => (
              <div key={attr.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-neutral-400 uppercase tracking-wider">
                    {attr.name}
                  </label>
                  <span className="text-xs text-neutral-600">
                    Weight: {weights[idx] ?? 0}%
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
              className="px-4 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800
                         text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              {currentSubjectIdx > 0 ? "Previous" : "Back to Ranking"}
            </button>

            <div className="flex gap-1.5">
              {subjects.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSubjectIdx(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    i === currentSubjectIdx
                      ? "bg-white"
                      : "bg-neutral-700 hover:bg-neutral-500"
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
              className="px-4 py-2.5 rounded-lg bg-white text-neutral-900 font-semibold
                         hover:bg-neutral-200 transition-colors"
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
            <h2 className="text-xl font-bold">Your Top 5</h2>
            <p className="text-neutral-500 text-sm mt-1">
              Based on your attribute rankings and scores
            </p>
          </div>

          <div className="space-y-3">
            {results.map((r, idx) => (
              <div
                key={r.subject.id}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                  idx < 5
                    ? "bg-neutral-900 border-neutral-700"
                    : "bg-neutral-950 border-neutral-800 opacity-60"
                }`}
              >
                <span
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                    idx === 0
                      ? "bg-yellow-500/20 text-yellow-400"
                      : idx === 1
                        ? "bg-neutral-400/20 text-neutral-300"
                        : idx === 2
                          ? "bg-orange-500/20 text-orange-400"
                          : "bg-neutral-800 text-neutral-500"
                  }`}
                >
                  {idx + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{r.subject.name}</p>
                  {r.subject.era && (
                    <p className="text-xs text-neutral-500">{r.subject.era}</p>
                  )}
                </div>

                <div className="text-right">
                  <p className="font-mono font-bold text-lg">
                    {r.score.toFixed(1)}
                  </p>
                  <p className="text-xs text-neutral-500">weighted</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4">
            <button
              onClick={() => {
                setCurrentSubjectIdx(0);
                setStep("score");
              }}
              className="px-4 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800
                         text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              Edit Scores
            </button>

            {userId ? (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 rounded-lg bg-white text-neutral-900 font-semibold
                           hover:bg-neutral-200 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Lock In My List"}
              </button>
            ) : (
              <a
                href="/login"
                className="px-6 py-3 rounded-lg bg-white text-neutral-900 font-semibold
                           hover:bg-neutral-200 transition-colors inline-block"
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
