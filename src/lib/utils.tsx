import React from "react";

/**
 * Takes a topic title and wraps occurrences of "TOP" and "5"
 * in a <span> with the brand-glow animation class.
 */
export function brandHighlight(title: string): React.ReactNode {
  const upper = title.toUpperCase();
  // Split on the words "TOP" or the standalone number "5"
  // Use word boundaries so we don't match inside other words
  const parts = upper.split(/\b(TOP|5)\b/);

  if (parts.length === 1) {
    return upper;
  }

  return parts.map((part, i) => {
    if (part === "TOP" || part === "5") {
      return (
        <span key={i} className="brand-glow text-white font-bold">
          {part}
        </span>
      );
    }
    return part;
  });
}
