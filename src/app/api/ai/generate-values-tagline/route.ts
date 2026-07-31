import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";

/** Cheap Claude call, but still billed. Generous cap. */
const TAGLINE_LIMIT = 30;
const TAGLINE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`tagline:${auth.userId}`, TAGLINE_LIMIT, TAGLINE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
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
        model: "claude-sonnet-4-20250514",
        max_tokens: 64,
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
    const tagline = data?.content?.[0]?.text?.trim() ?? null;
    return NextResponse.json({ tagline });
  } catch {
    return NextResponse.json({ tagline: null }, { status: 200 });
  }
}
