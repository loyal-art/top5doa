import { Filter } from "bad-words";

const filter = new Filter();

export const PROFANITY_MESSAGE =
  "Please remove inappropriate language before submitting.";

/** Returns true if the text contains profanity. */
export function containsProfanity(text: string): boolean {
  return filter.isProfane(text);
}

/** Replaces bad words with asterisks. */
export function cleanProfanity(text: string): string {
  return filter.clean(text);
}

export interface FlaggedWord {
  word: string;
  field: string;
}

/**
 * Checks a map of field name → text for profanity.
 * Returns an array of { word, field } for every flagged token found.
 */
export function getFlaggedDetails(fields: Record<string, string>): FlaggedWord[] {
  const results: FlaggedWord[] = [];
  for (const [fieldName, text] of Object.entries(fields)) {
    if (!text) continue;
    const tokens = text.split(/\s+/);
    for (const token of tokens) {
      const clean = token.replace(/[^a-zA-Z]/g, "");
      if (clean && filter.isProfane(clean)) {
        results.push({ word: token, field: fieldName });
      }
    }
  }
  return results;
}
