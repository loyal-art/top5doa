/**
 * Aura System — tier definitions, glow colors, and award helpers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Tier ladder ───────────────────────────────────────────────────────────────

export type AuraTier = {
  name: string;
  minPoints: number;
  glowColor: string; // hex or special value
};

export const TIERS: AuraTier[] = [
  { name: "Ghost",        minPoints: 0,     glowColor: "#6b7280" },
  { name: "Cold",         minPoints: 50,    glowColor: "#3B82F6" },
  { name: "Warming Up",   minPoints: 150,   glowColor: "#93C5FD" },
  { name: "Known",        minPoints: 350,   glowColor: "#22C55E" },
  { name: "Recognized",   minPoints: 750,   glowColor: "#06B6D4" },
  { name: "Respected",    minPoints: 1000,  glowColor: "#A855F7" },
  { name: "Elite",        minPoints: 1500,  glowColor: "#6366F1" },
  { name: "Influencer",   minPoints: 2500,  glowColor: "#EAB308" },
  { name: "Power Player", minPoints: 4000,  glowColor: "#F97316" },
  { name: "Icon",         minPoints: 6000,  glowColor: "#EA580C" },
  { name: "Superstar",    minPoints: 7500,  glowColor: "#F59E0B" },
  { name: "Legendary",    minPoints: 9000,  glowColor: "#DC2626" },
  { name: "Hall of Fame", minPoints: 13000, glowColor: "#EF4444" },
  { name: "GOAT",         minPoints: 20000, glowColor: "#FF0000" },
  { name: "Immortal",     minPoints: 30000, glowColor: "#991B1B" },
  { name: "Mythic",       minPoints: 40000, glowColor: "#BE185D" },
  { name: "Aura Beast",   minPoints: 50000, glowColor: "rainbow" },
] as const;

// ── Tier helpers ──────────────────────────────────────────────────────────────

/** Returns the tier name for a given aura point total. */
export function getTierForAura(aura: number): string {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (aura >= TIERS[i].minPoints) return TIERS[i].name;
  }
  return "Ghost";
}

/** Returns the CSS box-shadow glow color for a tier name. */
export function getGlowColor(tierName: string): string {
  const tier = TIERS.find((t) => t.name === tierName);
  return tier?.glowColor ?? "#6b7280";
}

/**
 * Returns info about the next tier, or null if already at max tier.
 * `remaining` is how many more points are needed to reach the next tier.
 */
export function getNextTier(
  aura: number
): { name: string; auraNeeded: number; remaining: number } | null {
  for (const tier of TIERS) {
    if (aura < tier.minPoints) {
      return {
        name: tier.name,
        auraNeeded: tier.minPoints,
        remaining: tier.minPoints - aura,
      };
    }
  }
  return null; // max tier
}

// ── Aura action types ─────────────────────────────────────────────────────────

export type AuraAction =
  | "vote"
  | "share"
  | "receive_follow"
  | "follow"
  | "flame"
  | "suggest_topic"
  | "suggestion_vote";

export const AURA_POINTS: Record<AuraAction, number> = {
  vote:            10,
  share:           25,
  receive_follow:  10,
  follow:           1,
  flame:            2,
  suggest_topic:    3,
  suggestion_vote:  1,
};

// ── Client-side awardAura ─────────────────────────────────────────────────────

/**
 * Awards aura to a user by calling the `award_aura` Postgres RPC.
 * Returns true if points were awarded, false if it was a duplicate or
 * a daily limit was hit.
 */
export async function awardAura(
  supabase: SupabaseClient,
  userId: string,
  action: AuraAction,
  referenceId?: string
): Promise<boolean> {
  const points = AURA_POINTS[action];
  const { data, error } = await supabase.rpc("award_aura", {
    p_user_id:      userId,
    p_action:       action,
    p_points:       points,
    p_reference_id: referenceId ?? null,
  });
  if (error) {
    console.error("[awardAura] RPC error:", error);
    return false;
  }
  return data === true;
}

// ── Tier badge CSS classes (Tailwind) ─────────────────────────────────────────

/**
 * Returns Tailwind classes for the tier badge chip.
 * Falls back to Ghost styling for unknown tier names.
 */
export function getTierBadgeClasses(tierName: string): string {
  const map: Record<string, string> = {
    "Ghost":        "text-neutral-500 bg-neutral-700/30 border-neutral-700",
    "Cold":         "text-blue-400 bg-blue-400/10 border-blue-400/30",
    "Warming Up":   "text-blue-300 bg-blue-300/10 border-blue-300/30",
    "Known":        "text-green-400 bg-green-400/10 border-green-400/30",
    "Recognized":   "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
    "Respected":    "text-purple-400 bg-purple-400/10 border-purple-400/30",
    "Elite":        "text-indigo-400 bg-indigo-400/10 border-indigo-400/30",
    "Influencer":   "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
    "Power Player": "text-orange-400 bg-orange-400/10 border-orange-400/30",
    "Icon":         "text-orange-600 bg-orange-600/10 border-orange-600/30",
    "Superstar":    "text-amber-400 bg-amber-400/10 border-amber-400/30",
    "Legendary":    "text-red-500 bg-red-500/10 border-red-500/30",
    "Hall of Fame": "text-red-400 bg-red-400/10 border-red-400/30",
    "GOAT":         "text-red-500 bg-red-500/15 border-red-500/40",
    "Immortal":     "text-red-800 bg-red-900/20 border-red-800/30",
    "Mythic":       "text-pink-600 bg-pink-600/10 border-pink-600/30",
    "Aura Beast":   "text-white bg-gradient-to-r from-red-500/20 via-purple-500/20 to-blue-500/20 border-white/30",
  };
  return map[tierName] ?? map["Ghost"]!;
}
