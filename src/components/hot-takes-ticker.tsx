"use client";

import Link from "next/link";
import { useState } from "react";

export type TickerTake = {
  id: string;
  content: string;
  flames: number;
  username: string;
  topic_title: string;
  topic_slug: string;
};

export function HotTakesTicker({ takes }: { takes: TickerTake[] }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || takes.length === 0) return null;

  // Duplicate items to create seamless loop
  const items = [...takes, ...takes];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-10 flex items-center"
      style={{ background: "#111", borderTop: "1px solid #e8ff00" }}
    >
      {/* Scrolling area */}
      <div className="flex-1 overflow-hidden relative h-full">
        <div
          className="hot-takes-ticker flex items-center gap-10 h-full whitespace-nowrap absolute"
          style={{ animationDuration: `${takes.length * 4}s` }}
        >
          {items.map((take, i) => (
            <Link
              key={`${take.id}-${i}`}
              href={`/hot-takes`}
              className="inline-flex items-center gap-1.5 text-sm font-mono shrink-0"
            >
              <span className="text-neutral-300">🔥</span>
              <span style={{ color: "#e8ff00" }}>@{take.username}:</span>
              <span className="text-neutral-300">
                &ldquo;{take.content.length > 80
                  ? take.content.slice(0, 80) + "…"
                  : take.content}&rdquo;
              </span>
              <span className="text-neutral-500">—</span>
              <span className="text-neutral-400">{take.topic_title}</span>
              <span style={{ color: "#FF4500" }} className="font-bold">
                🔥{take.flames}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 w-10 h-full flex items-center justify-center text-neutral-600 hover:text-neutral-300 transition-colors"
        style={{ background: "#111" }}
        aria-label="Dismiss ticker"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
