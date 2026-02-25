"use client";

import { useCallback, useRef, useState } from "react";
import type { Database } from "@/lib/types/database";

type Attribute = Database["public"]["Tables"]["attributes"]["Row"];

interface AttributeRankerProps {
  attributes: Attribute[];
  weights: number[];
  onReorder: (ids: string[]) => void;
}

export function AttributeRanker({
  attributes,
  weights,
  onReorder,
}: AttributeRankerProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback(
    (idx: number) => (e: React.DragEvent) => {
      setDragIdx(idx);
      e.dataTransfer.effectAllowed = "move";
      // Set a transparent drag image
      const el = e.currentTarget as HTMLElement;
      e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
    },
    [],
  );

  const handleDragOver = useCallback(
    (idx: number) => (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setOverIdx(idx);
    },
    [],
  );

  const handleDrop = useCallback(
    (idx: number) => (e: React.DragEvent) => {
      e.preventDefault();
      if (dragIdx === null || dragIdx === idx) {
        setDragIdx(null);
        setOverIdx(null);
        return;
      }
      const ids = attributes.map((a) => a.id);
      const [moved] = ids.splice(dragIdx, 1);
      ids.splice(idx, 0, moved);
      onReorder(ids);
      setDragIdx(null);
      setOverIdx(null);
    },
    [dragIdx, attributes, onReorder],
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  // Move up/down via buttons (accessibility)
  const moveUp = useCallback(
    (idx: number) => {
      if (idx === 0) return;
      const ids = attributes.map((a) => a.id);
      [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
      onReorder(ids);
    },
    [attributes, onReorder],
  );

  const moveDown = useCallback(
    (idx: number) => {
      if (idx === attributes.length - 1) return;
      const ids = attributes.map((a) => a.id);
      [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
      onReorder(ids);
    },
    [attributes, onReorder],
  );

  return (
    <div ref={containerRef} className="space-y-2">
      {attributes.map((attr, idx) => (
        <div
          key={attr.id}
          draggable
          onDragStart={handleDragStart(idx)}
          onDragOver={handleDragOver(idx)}
          onDrop={handleDrop(idx)}
          onDragEnd={handleDragEnd}
          className={`
            flex items-center gap-3 p-4 rounded-xl border cursor-grab active:cursor-grabbing
            transition-all duration-150
            ${
              dragIdx === idx
                ? "opacity-40 scale-95"
                : overIdx === idx && dragIdx !== null
                  ? "border-brand-accent bg-brand-accent/5"
                  : "border-brand-border bg-brand-surface hover:border-neutral-600"
            }
          `}
        >
          {/* Rank badge */}
          <span
            className={`w-9 h-9 rounded-full flex items-center justify-center font-display text-lg flex-shrink-0 ${
              idx === 0
                ? "bg-brand-accent/20 text-brand-accent"
                : idx === 1
                  ? "bg-neutral-400/20 text-neutral-300"
                  : idx === 2
                    ? "bg-orange-500/20 text-orange-400"
                    : "bg-brand-border text-neutral-600"
            }`}
          >
            {idx + 1}
          </span>

          {/* Drag handle */}
          <svg
            className="w-5 h-5 text-neutral-700 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 8h16M4 16h16"
            />
          </svg>

          {/* Attribute info */}
          <div className="flex-1 min-w-0">
            <p className="font-mono text-sm font-bold text-white uppercase tracking-wider truncate">
              {attr.name}
            </p>
            {attr.description && (
              <p className="text-xs text-neutral-600 font-body truncate mt-0.5">
                {attr.description}
              </p>
            )}
          </div>

          {/* Weight display */}
          <span className="text-sm text-brand-accent font-mono font-bold flex-shrink-0">
            {weights[idx] ?? 0}%
          </span>

          {/* Up/Down buttons */}
          <div className="flex flex-col gap-0.5 flex-shrink-0">
            <button
              onClick={() => moveUp(idx)}
              disabled={idx === 0}
              className="p-1 rounded hover:bg-brand-border disabled:opacity-20 transition-colors"
              aria-label={`Move ${attr.name} up`}
            >
              <svg
                className="w-3.5 h-3.5 text-neutral-400"
                fill="none"
                viewBox="0 0 14 14"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2 9l5-5 5 5"
                />
              </svg>
            </button>
            <button
              onClick={() => moveDown(idx)}
              disabled={idx === attributes.length - 1}
              className="p-1 rounded hover:bg-brand-border disabled:opacity-20 transition-colors"
              aria-label={`Move ${attr.name} down`}
            >
              <svg
                className="w-3.5 h-3.5 text-neutral-400"
                fill="none"
                viewBox="0 0 14 14"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2 5l5 5 5-5"
                />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
