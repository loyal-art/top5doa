"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Haptic feedback — Web Vibration API with feature detection
// ---------------------------------------------------------------------------

function canVibrate(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

function vibrate(pattern: number | number[]): void {
  if (canVibrate()) {
    navigator.vibrate(pattern);
  }
}

/** Maps a score (1–99) to a vibration duration in ms. */
function scoreToHapticMs(score: number, min: number, max: number): number {
  const t = (score - min) / (max - min); // 0–1
  // 4ms at low end → 45ms at high end, quadratic curve for feel
  return Math.round(4 + 41 * t * t);
}

/** Distinct celebration burst pattern: [vibrate, pause, …] */
const CELEBRATION_HAPTIC = [40, 30, 60, 30, 80, 40, 120];

// ---------------------------------------------------------------------------
// Color interpolation — dull gray → yellow-green → hot red
// ---------------------------------------------------------------------------

interface ColorStop {
  t: number; // 0–1 position
  h: number; // hue
  s: number; // saturation %
  l: number; // lightness %
}

const COLOR_STOPS: ColorStop[] = [
  { t: 0.0, h: 220, s: 8, l: 55 }, // dull gray
  { t: 0.25, h: 55, s: 55, l: 50 }, // warm yellow
  { t: 0.5, h: 80, s: 65, l: 42 }, // yellow-green
  { t: 0.75, h: 25, s: 90, l: 50 }, // orange
  { t: 1.0, h: 0, s: 85, l: 50 }, // hot red
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function getColorAtT(t: number): { h: number; s: number; l: number } {
  const clamped = Math.max(0, Math.min(1, t));

  // Find the two surrounding stops
  let low = COLOR_STOPS[0];
  let high = COLOR_STOPS[COLOR_STOPS.length - 1];

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (clamped >= COLOR_STOPS[i].t && clamped <= COLOR_STOPS[i + 1].t) {
      low = COLOR_STOPS[i];
      high = COLOR_STOPS[i + 1];
      break;
    }
  }

  const segmentT =
    high.t === low.t ? 0 : (clamped - low.t) / (high.t - low.t);

  return {
    h: lerp(low.h, high.h, segmentT),
    s: lerp(low.s, high.s, segmentT),
    l: lerp(low.l, high.l, segmentT),
  };
}

function hslString(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

// Build a CSS linear-gradient for the full track
function buildTrackGradient(): string {
  const steps = 20;
  const stops: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const { h, s, l } = getColorAtT(t);
    stops.push(`${hslString(h, s, l)} ${(t * 100).toFixed(1)}%`);
  }
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

const TRACK_GRADIENT = buildTrackGradient();

// ---------------------------------------------------------------------------
// Particle data for the celebration burst
// ---------------------------------------------------------------------------

interface Particle {
  id: number;
  tx: number;
  ty: number;
  color: string;
  delay: number;
  size: number;
}

const CELEBRATION_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#fbbf24",
  "#f43f5e",
  "#ffffff",
];

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const distance = 30 + Math.random() * 50;
    return {
      id: i,
      tx: Math.cos(angle) * distance,
      ty: Math.sin(angle) * distance,
      color:
        CELEBRATION_COLORS[
          Math.floor(Math.random() * CELEBRATION_COLORS.length)
        ],
      delay: Math.random() * 0.15,
      size: 4 + Math.random() * 4,
    };
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SubjectScoreSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function SubjectScoreSlider({
  value,
  onChange,
  min = 1,
  max = 99,
}: SubjectScoreSliderProps) {
  const [celebrating, setCelebrating] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const prevValue = useRef(value);

  // Normalize value to 0–1 range for color lookup
  const t = (value - min) / (max - min);
  const { h, s, l } = getColorAtT(t);
  const currentColor = hslString(h, s, l);
  const glowColor = hslString(h, s, l + 10);
  const pct = (t * 100).toFixed(1);

  // Build the filled/unfilled track background
  const trackBg = useMemo(() => {
    return `linear-gradient(to right, ${TRACK_GRADIENT.slice(
      "linear-gradient(to right, ".length,
      -1
    )}) 0% / ${pct}% 100% no-repeat, hsl(220, 6%, 22%)`;
  }, [pct]);

  // Trigger celebration when value reaches max
  useEffect(() => {
    if (value === max && prevValue.current !== max) {
      vibrate(CELEBRATION_HAPTIC);
      setCelebrating(true);
      setParticles(generateParticles(18));
      const timeout = setTimeout(() => {
        setCelebrating(false);
        setParticles([]);
      }, 1200);
      return () => clearTimeout(timeout);
    }
    prevValue.current = value;
  }, [value, max]);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = Number(e.target.value);
      if (next !== prevValue.current) {
        vibrate(scoreToHapticMs(next, min, max));
      }
      onChange(next);
    },
    [onChange, min, max],
  );

  const increment = useCallback(() => {
    if (value < max) {
      const next = value + 1;
      vibrate(scoreToHapticMs(next, min, max));
      onChange(next);
    }
  }, [value, max, min, onChange]);

  const decrement = useCallback(() => {
    if (value > min) {
      const next = value - 1;
      vibrate(scoreToHapticMs(next, min, max));
      onChange(next);
    }
  }, [value, min, max, onChange]);

  // Keyboard: hold arrow for repeat
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRepeat = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startRepeat = useCallback(
    (action: () => void) => {
      action();
      intervalRef.current = setInterval(action, 80);
    },
    [],
  );

  useEffect(() => {
    return stopRepeat;
  }, [stopRepeat]);

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Slider track */}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={handleSliderChange}
        className="score-slider"
        style={
          {
            "--track-bg": trackBg,
            "--thumb-color": currentColor,
            "--thumb-glow": glowColor,
          } as React.CSSProperties
        }
      />

      {/* Controls: down arrow | value | up arrow */}
      <div className="flex items-center justify-center gap-3">
        {/* Down arrow */}
        <button
          onMouseDown={() => startRepeat(decrement)}
          onMouseUp={stopRepeat}
          onMouseLeave={stopRepeat}
          onTouchStart={() => startRepeat(decrement)}
          onTouchEnd={stopRepeat}
          disabled={value <= min}
          className="flex items-center justify-center w-10 h-10 rounded-lg
                     bg-neutral-800 border border-neutral-700
                     text-neutral-300 hover:bg-neutral-700 hover:text-white
                     active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed
                     transition-all duration-100 select-none"
          aria-label="Decrease score"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className="translate-y-[1px]"
          >
            <path
              d="M2 5L7 10L12 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Value display + celebration particles */}
        <div className="relative flex items-center justify-center">
          <span
            className={`
              inline-flex items-center justify-center
              min-w-[3.5rem] px-3 py-1.5
              rounded-lg font-mono text-xl font-bold
              transition-all duration-150
              ${celebrating ? "celebrating-value" : ""}
            `}
            style={{
              color: currentColor,
              backgroundColor: `hsl(${Math.round(h)}, ${Math.round(s * 0.3)}%, 12%)`,
              border: `2px solid ${currentColor}`,
            }}
          >
            {value}
          </span>

          {/* Celebration particles */}
          {particles.map((p) => (
            <span
              key={p.id}
              className="celebration-particle"
              style={
                {
                  "--tx": `${p.tx}px`,
                  "--ty": `${p.ty}px`,
                  backgroundColor: p.color,
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  left: "50%",
                  top: "50%",
                  marginLeft: `-${p.size / 2}px`,
                  marginTop: `-${p.size / 2}px`,
                  animationDelay: `${p.delay}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        {/* Up arrow */}
        <button
          onMouseDown={() => startRepeat(increment)}
          onMouseUp={stopRepeat}
          onMouseLeave={stopRepeat}
          onTouchStart={() => startRepeat(increment)}
          onTouchEnd={stopRepeat}
          disabled={value >= max}
          className="flex items-center justify-center w-10 h-10 rounded-lg
                     bg-neutral-800 border border-neutral-700
                     text-neutral-300 hover:bg-neutral-700 hover:text-white
                     active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed
                     transition-all duration-100 select-none"
          aria-label="Increase score"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className="-translate-y-[1px]"
          >
            <path
              d="M2 9L7 4L12 9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
