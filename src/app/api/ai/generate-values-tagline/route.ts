import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-guard";

export async function POST(req: NextRequest) {
  const guard = await requireUser("ai/generate-values-tagline");
  if (!guard.ok) return guard.response;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[generate-values-tagline] ANTHROPIC_API_KEY is not configured");
    return NextResponse.json({ error: "Tagline generation is unavailable." }, { status: 500 });
  }

  const { topicTitle, topAttribute, bottomAttribute } = await req.json();
  if (!topicTitle || !topAttribute || !bottomAttribute) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 64,
        // Sonnet 5 runs adaptive thinking unless told otherwise; these routes want
        // a plain text completion, and thinking would eat the max_tokens budget.
        thinking: { type: "disabled" },
        system: `Given these ranked attributes for a ${topicTitle} topic, write a short punchy values statement for a poster. The user ranked ${topAttribute} highest and ${bottomAttribute} lowest. Write it as two contrast pairs like: "Heart over hype. Grit over glory." Rules: Do NOT use the attribute names verbatim — rephrase them with synonyms or similar meaning. Keep it under 12 words total. Return ONLY the tagline, nothing else.`,
        messages: [
          { role: "user", content: `Top attribute: ${topAttribute}\nBottom attribute: ${bottomAttribute}` },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ tagline: null }, { status: 200 });
    }

    const data = await res.json();
    const tagline = data?.content?.find(
      (b: { type: string; text?: string }) => b.type === "text",
    )?.text?.trim() ?? null;
    return NextResponse.json({ tagline });
  } catch {
    return NextResponse.json({ tagline: null }, { status: 200 });
  }
}
