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
