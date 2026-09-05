import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-guard";
import {
  DEMO_ATTRIBUTE_COUNT,
  DEMO_SUBJECT_COUNT,
  type TopicMode,
} from "@/lib/demo-topic";

const TOPIC_SHAPES: Record<
  TopicMode,
  { instruction: string; exact: { subjects: number; attributes: number } | null }
> = {
  standard: {
    instruction:
      "Generate 15-25 subjects (the people, teams, items, etc. that users will rank) and 5-8 attributes (the criteria users score each subject on, like \"Scoring\", \"Legacy\", \"Impact\").",
    exact: null,
  },
  demo: {
    instruction: `Generate EXACTLY ${DEMO_SUBJECT_COUNT} subjects (the people, teams, items, etc. that users will rank) and EXACTLY ${DEMO_ATTRIBUTE_COUNT} attributes (the criteria users score each subject on, like "Scoring", "Legacy", "Impact"). The counts are strict: the subjects array must contain exactly ${DEMO_SUBJECT_COUNT} entries and the attributes array must contain exactly ${DEMO_ATTRIBUTE_COUNT} entries — no more, no fewer.`,
    exact: { subjects: DEMO_SUBJECT_COUNT, attributes: DEMO_ATTRIBUTE_COUNT },
  },
};

const SYSTEM_PREFIX =
  'You are a hype content writer for a "Top 5 of All Time" debate platform. Your vibe is TikTok/MrBeast energy — punchy, bold, opinionated, debate bait. Return ONLY valid JSON with no markdown, no code fences, no extra text. The JSON must have this exact structure: { "subjects": [{ "name": "string", "description": "string", "era": "string or null" }], "attributes": [{ "name": "string", "description": "string" }] }. ';
const SYSTEM_SUFFIX =
  ' CRITICAL STYLE RULES for ALL descriptions: Write like you\'re starting an argument in a group chat. 1-2 sentences MAX. Short punchy sentences. Bold opinions and hot takes that make people want to vote and argue. Use slang where it fits. No boring encyclopedia energy — every description should feel like debate bait. For subjects: hype them up OR call out their flaws, be spicy and divisive. For attributes: describe what it measures in a way that gets people fired up to score. Era should be a time period if applicable (null otherwise).';

export async function POST(req: NextRequest) {
  const guard = await requireAdmin("ai/generate-topic");
  if (!guard.ok) return guard.response;

  const { title, categories, mode: rawMode } = await req.json();

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // "standard" is the default and preserves the original full-size behavior.
  // "demo" generates the fixed shape the anonymous archetype quiz needs.
  const mode: TopicMode = rawMode === undefined ? "standard" : rawMode;
  if (mode !== "standard" && mode !== "demo") {
    return NextResponse.json(
      { error: 'mode must be "standard" or "demo"' },
      { status: 400 }
    );
  }
  const shape = TOPIC_SHAPES[mode];

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
      model: "claude-sonnet-5",
      // A full-size 20-subject response with punchy descriptions runs well
      // past 2048 tokens; 8192 leaves comfortable headroom. If the model
      // still hits the cap we detect it below rather than failing on parse.
      max_tokens: 8192,
      // Sonnet 5 runs adaptive thinking unless told otherwise; these routes want
      // a plain JSON completion, and thinking would eat the max_tokens budget.
      thinking: { type: "disabled" },
      system: SYSTEM_PREFIX + shape.instruction + SYSTEM_SUFFIX,
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

  if (data.stop_reason === "max_tokens") {
    return NextResponse.json(
      {
        error:
          "AI response was cut off before it finished (hit the token limit), so the JSON is incomplete. Nothing was saved — try generating again, or use fewer/shorter subjects.",
      },
      { status: 502 }
    );
  }
  // Pick the text block explicitly — content[0] is not guaranteed to be text.
  const content = data.content?.find(
    (b: { type: string; text?: string }) => b.type === "text",
  )?.text;

  if (!content) {
    return NextResponse.json(
      { error: "No content in API response" },
      { status: 502 }
    );
  }

  // Sonnet 5 tends to wrap JSON in markdown fences despite the system prompt.
  const cleaned = String(content).trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let parsed: { subjects?: unknown; attributes?: unknown };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse AI response as JSON", raw: content },
      { status: 502 }
    );
  }

  if (shape.exact) {
    const subjectCount = Array.isArray(parsed.subjects) ? parsed.subjects.length : 0;
    const attributeCount = Array.isArray(parsed.attributes) ? parsed.attributes.length : 0;
    if (
      subjectCount !== shape.exact.subjects ||
      attributeCount !== shape.exact.attributes
    ) {
      return NextResponse.json(
        {
          error: `Demo topic must have exactly ${shape.exact.subjects} subjects and ${shape.exact.attributes} attributes, but the AI returned ${subjectCount} subjects and ${attributeCount} attributes. Nothing was saved — try generating again.`,
        },
        { status: 502 }
      );
    }
  }

  return NextResponse.json(parsed);
}
