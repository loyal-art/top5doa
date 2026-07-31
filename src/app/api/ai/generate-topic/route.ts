import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { title, categories } = await req.json();

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const categoryContext =
    categories && categories.length > 0
      ? `Categories: ${categories.join(", ")}.`
      : "";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system:
        'You are a hype content writer for a "Top 5 of All Time" debate platform. Your vibe is TikTok/MrBeast energy — punchy, bold, opinionated, debate bait. Return ONLY valid JSON with no markdown, no code fences, no extra text. The JSON must have this exact structure: { "subjects": [{ "name": "string", "description": "string", "era": "string or null" }], "attributes": [{ "name": "string", "description": "string" }] }. Generate 15-25 subjects (the people, teams, items, etc. that users will rank) and 5-8 attributes (the criteria users score each subject on, like "Scoring", "Legacy", "Impact"). CRITICAL STYLE RULES for ALL descriptions: Write like you\'re starting an argument in a group chat. 1-2 sentences MAX. Short punchy sentences. Bold opinions and hot takes that make people want to vote and argue. Use slang where it fits. No boring encyclopedia energy — every description should feel like debate bait. For subjects: hype them up OR call out their flaws, be spicy and divisive. For attributes: describe what it measures in a way that gets people fired up to score. Era should be a time period if applicable (null otherwise).',
      messages: [
        {
          role: "user",
          content: `Generate subjects and attributes for this debate topic: "${title}". ${categoryContext} The subjects should be well-known, debatable picks that fans would argue about. The attributes should be meaningful criteria for comparing the subjects.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `Anthropic API error: ${res.status} ${text}` },
      { status: 502 }
    );
  }

  const data = await res.json();
  const content = data.content?.[0]?.text;

  if (!content) {
    return NextResponse.json(
      { error: "No content in API response" },
      { status: 502 }
    );
  }

  try {
    const parsed = JSON.parse(content);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse AI response as JSON", raw: content },
      { status: 502 }
    );
  }
}
