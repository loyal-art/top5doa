"use client";

import { useState } from "react";
import { SubjectScoreSlider } from "@/components/subject-score-slider";

const DEMO_ATTRIBUTES = [
  { name: "Scoring", subject: "LeBron James" },
  { name: "Defense", subject: "LeBron James" },
  { name: "Playmaking", subject: "LeBron James" },
  { name: "Athleticism", subject: "LeBron James" },
];

export default function Home() {
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(DEMO_ATTRIBUTES.map((a) => [a.name, 50])),
  );

  const updateScore = (attr: string, value: number) => {
    setScores((prev) => ({ ...prev, [attr]: value }));
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-10">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Rate: LeBron James
          </h1>
          <p className="text-neutral-500 text-sm">
            Score each attribute from 1–99
          </p>
        </div>

        <div className="space-y-8">
          {DEMO_ATTRIBUTES.map((attr) => (
            <div key={attr.name} className="space-y-2">
              <label className="block text-sm font-medium text-neutral-400 uppercase tracking-wider">
                {attr.name}
              </label>
              <SubjectScoreSlider
                value={scores[attr.name]}
                onChange={(v) => updateScore(attr.name, v)}
              />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
