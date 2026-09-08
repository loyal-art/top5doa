"use client";

import { useEffect, useState } from "react";
import type { ArchetypeResult } from "@/lib/archetypes";

interface ArchetypeRevealProps {
  result: ArchetypeResult;
  topicTitle: string;
  /** Called when the reveal is dismissed — by the auto fade or the tap. */
  onDone: () => void;
  /**
   * When true (the voting flow default), the overlay fades itself out ~7s in.
   * The quiz sets this false so the result stays up until the visitor taps.
   */
  autoDismiss?: boolean;
}

// 0=hidden, 1=intro, 2=name, 3=desc, 4=secondary, 5=done
type Phase = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Full-screen archetype reveal. Owns its own phase timers so callers only
 * mount it with a result and wait for `onDone`.
 */
export function ArchetypeReveal({
  result,
  topicTitle,
  onDone,
  autoDismiss = true,
}: ArchetypeRevealProps) {
  const [phase, setPhase] = useState<Phase>(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => setPhase(1), 0),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 3000),
      setTimeout(() => setPhase(4), 4500),
    ];
    if (autoDismiss) {
      timers.push(
        setTimeout(() => {
          setPhase(5);
          timers.push(setTimeout(onDone, 1200));
        }, 6000),
      );
    }
    return () => timers.forEach(clearTimeout);
    // Timers run once per mount; onDone is read when they fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDismiss]);

  function dismiss() {
    setPhase(5);
    setTimeout(onDone, 300);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/95 backdrop-blur-md">
      <div className="text-center px-6 max-w-lg mx-auto space-y-6">
        {/* Phase 1: Intro text */}
        <p
          className={`font-mono text-sm uppercase tracking-[0.3em] transition-all duration-700 ${
            phase >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ color: "#a0a0a0" }}
        >
          When it comes to {topicTitle}...
        </p>

        {/* Phase 2: Big reveal — icon + name */}
        <div
          className={`transition-all duration-700 ${
            phase >= 2 ? "opacity-100 scale-100" : "opacity-0 scale-75"
          }`}
        >
          <p className="text-5xl mb-3">{result.primary.icon}</p>
          <h2
            className="font-display text-4xl sm:text-5xl tracking-wide archetype-glow"
            style={{ color: "#FFD700" }}
          >
            YOU ARE {result.primary.name.toUpperCase()}
          </h2>
        </div>

        {/* Phase 3: Description + dynamic explanation */}
        <div
          className={`space-y-3 transition-all duration-700 ${
            phase >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <p className="text-neutral-300 font-body text-base leading-relaxed">
            {result.primary.base_description}
          </p>
          <p className="text-neutral-400 font-body text-sm italic leading-relaxed">
            {result.dynamicExplanation}
          </p>
        </div>

        {/* Phase 4: Secondary archetype */}
        {result.secondaryPhrase && (
          <p
            className={`font-mono text-sm transition-all duration-700 ${
              phase >= 4 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ color: "#a78bfa" }}
          >
            {result.secondaryPhrase}
          </p>
        )}

        {/* Phase 5: fade out indicator */}
        {phase >= 4 && (
          <button
            type="button"
            onClick={dismiss}
            className={`font-mono text-xs text-neutral-600 hover:text-neutral-400 transition-all duration-500 mt-4 ${
              phase >= 4 ? "opacity-100" : "opacity-0"
            }`}
          >
            tap to continue
          </button>
        )}
      </div>
    </div>
  );
}
