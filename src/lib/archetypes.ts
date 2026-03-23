/**
 * Archetype System — scoring engine, dynamic explanations, and helpers.
 *
 * Archetypes represent patterns of values — how a user weighs what matters
 * when judging greatness. The scoring engine matches a user's attribute
 * rankings against each archetype's weight profile.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Types ────────────────────────────────────────────────────────────────────

export type TopicArchetype = {
  id: string;
  topic_id: string;
  name: string;
  base_description: string;
  icon: string;
  attribute_weights: Record<string, number>; // attribute_id → weight 1-5
};

export type ArchetypeResult = {
  primary: TopicArchetype;
  primaryScore: number;
  secondary: TopicArchetype | null;
  secondaryScore: number;
  primaryMargin: number;
  dynamicExplanation: string;
  secondaryPhrase: string | null;
};

// ── Scoring Engine ───────────────────────────────────────────────────────────

/**
 * Calculate archetype scores for a user based on their attribute rankings.
 *
 * Steps:
 * 1. Convert rank positions to weights (rank 1 = N points, rank 2 = N-1, etc.)
 * 2. For each archetype: score = sum(userWeight × archetypeWeight)
 * 3. Primary = highest score, secondary = second highest
 * 4. Secondary only included if margin < 0.15
 */
export function calculateArchetypeScores(
  rankedAttributeIds: string[],
  archetypes: TopicArchetype[],
): { archetypeId: string; score: number }[] {
  if (!archetypes.length || !rankedAttributeIds.length) return [];

  const n = rankedAttributeIds.length;

  // Convert rank positions to weights: rank 1 → N, rank 2 → N-1, etc.
  const userWeights: Record<string, number> = {};
  rankedAttributeIds.forEach((attrId, idx) => {
    userWeights[attrId] = n - idx;
  });

  // Score each archetype
  const scores = archetypes.map((archetype) => {
    let score = 0;
    for (const [attrId, archetypeWeight] of Object.entries(archetype.attribute_weights)) {
      const userWeight = userWeights[attrId] ?? 0;
      score += userWeight * archetypeWeight;
    }
    return { archetypeId: archetype.id, score };
  });

  // Sort descending
  scores.sort((a, b) => b.score - a.score);
  return scores;
}

/**
 * Full archetype calculation: scores + result with dynamic explanation.
 * Returns null if no archetypes exist for this topic.
 */
export function resolveArchetype(
  rankedAttributeIds: string[],
  archetypes: TopicArchetype[],
  attributeNames: Record<string, string>,
): ArchetypeResult | null {
  if (!archetypes.length || !rankedAttributeIds.length) return null;

  const scores = calculateArchetypeScores(rankedAttributeIds, archetypes);
  if (!scores.length) return null;

  const archetypeMap = Object.fromEntries(archetypes.map((a) => [a.id, a]));

  const primaryEntry = scores[0];
  const secondaryEntry = scores.length > 1 ? scores[1] : null;

  const primary = archetypeMap[primaryEntry.archetypeId];
  if (!primary) return null;

  const primaryScore = primaryEntry.score;
  const secondaryScore = secondaryEntry?.score ?? 0;
  const primaryMargin = primaryScore > 0
    ? (primaryScore - secondaryScore) / primaryScore
    : 0;

  const secondary = secondaryEntry && primaryMargin < 0.15
    ? archetypeMap[secondaryEntry.archetypeId] ?? null
    : null;

  // Top 2 attribute names for dynamic explanation
  const topAttr1 = attributeNames[rankedAttributeIds[0]] ?? "your top pick";
  const topAttr2 = rankedAttributeIds.length > 1
    ? attributeNames[rankedAttributeIds[1]] ?? "your second pick"
    : null;

  const dynamicExplanation = generateDynamicExplanation(
    primary,
    topAttr1,
    topAttr2,
  );

  const secondaryPhrase = secondary
    ? generateSecondaryPhrase(secondary.name)
    : null;

  return {
    primary,
    primaryScore,
    secondary,
    secondaryScore,
    primaryMargin,
    dynamicExplanation,
    secondaryPhrase,
  };
}

// ── Dynamic Explanation Engine ────────────────────────────────────────────────

/**
 * Generates a personalized explanation from the user's top attributes
 * and their matched archetype. NOT stored — generated at runtime.
 */
function generateDynamicExplanation(
  archetype: TopicArchetype,
  topAttr1: string,
  topAttr2: string | null,
): string {
  // Templates that reference the user's actual #1 and #2 attributes
  const templates = topAttr2
    ? [
        `You ranked ${topAttr1} above everything, and ${topAttr2} wasn't far behind. That's textbook ${archetype.name} energy.`,
        `${topAttr1} first, ${topAttr2} second — you know what actually matters. Not everyone sees it this way.`,
        `You put ${topAttr1} at the top and backed it up with ${topAttr2}. Anybody can talk — you care about who delivers.`,
        `${topAttr1} over everything, with ${topAttr2} right there. You're not chasing hype — you're chasing substance.`,
        `Leading with ${topAttr1} and valuing ${topAttr2}? That combo says a lot. You judge on what lasts, not what trends.`,
      ]
    : [
        `You ranked ${topAttr1} above everything else. That's pure ${archetype.name} energy.`,
        `${topAttr1} first — you know what actually matters. Not everyone sees it this way.`,
        `Leading with ${topAttr1} says everything. You care about what's real.`,
      ];

  // Deterministic pick based on archetype name hash
  const hash = archetype.name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return templates[hash % templates.length];
}

/**
 * Generates a natural secondary archetype phrase.
 */
function generateSecondaryPhrase(secondaryName: string): string {
  const phrases = [
    `With a touch of ${secondaryName}.`,
    `Leaning ${secondaryName}.`,
    `You've got some ${secondaryName} in you.`,
    `A hint of ${secondaryName} too.`,
  ];
  const hash = secondaryName.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return phrases[hash % phrases.length];
}

// ── Supabase helpers ─────────────────────────────────────────────────────────

/**
 * Fetch archetypes for a topic from the database.
 */
export async function fetchTopicArchetypes(
  supabase: SupabaseClient,
  topicId: string,
): Promise<TopicArchetype[]> {
  const { data, error } = await supabase
    .from("topic_archetypes")
    .select("*")
    .eq("topic_id", topicId);
  if (error || !data) return [];
  return data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    topic_id: row.topic_id as string,
    name: row.name as string,
    base_description: row.base_description as string,
    icon: (row.icon as string) ?? "🏆",
    attribute_weights: (row.attribute_weights as Record<string, number>) ?? {},
  }));
}

/**
 * Save a user's archetype result to the database.
 */
export async function saveUserArchetype(
  supabase: SupabaseClient,
  userId: string,
  topicId: string,
  result: ArchetypeResult,
): Promise<void> {
  // Upsert (unique on user_id + topic_id)
  await supabase.from("user_archetypes").upsert(
    {
      user_id: userId,
      topic_id: topicId,
      primary_archetype_id: result.primary.id,
      secondary_archetype_id: result.secondary?.id ?? null,
      primary_score: result.primaryScore,
      secondary_score: result.secondaryScore,
      primary_margin: result.primaryMargin,
    },
    { onConflict: "user_id,topic_id" },
  );
}
