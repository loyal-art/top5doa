import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { topicTitle, attributes, subjects } = await req.json();

  if (!topicTitle || !attributes || !Array.isArray(attributes) || attributes.length === 0) {
    return NextResponse.json(
      { error: "topicTitle and attributes[] are required" },
      { status: 400 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 },
    );
  }

  const attributeList = attributes.map((a: { id: string; name: string }) => a.name).join(", ");
  const subjectContext = subjects && subjects.length > 0
    ? `\nSubjects being ranked: ${subjects.map((s: { name: string }) => s.name).join(", ")}.`
    : "";

  // Build the attribute_weights instructions with actual attribute IDs
  const attributeIdMap = attributes
    .map((a: { id: string; name: string }) => `"${a.id}": <weight 1-5> (${a.name})`)
    .join(", ");

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
      system: `You are a personality expert and creative director for a viral ranking app called TOP5DOA.
Generate exactly 5 archetypes for the topic "${topicTitle}" based on these attributes: ${attributeList}.${subjectContext}

Each archetype represents a distinct way of judging greatness — a philosophy, not a stat.

Rules:
- Names must feel like identities someone would proudly claim: "I'm ____ when it comes to ____"
- 2-3 words preferred, "The ___" format works but allow exceptions if stronger
- Each archetype must feel like a different kind of person — clearly distinct
- Descriptions must be 1-2 sentences. First = what they value. Second = personality insight (slightly bold, conversational tone)
- Attribute weights: assign 1-5 for EACH attribute (1=barely cares, 5=lives and dies by it)
- Each archetype should weight attributes differently — this is what makes them distinct
- Include a single emoji icon that captures the archetype's vibe
- Should trigger pride, defensiveness, or curiosity — these are identities users want to claim

Return ONLY valid JSON with no markdown, no code fences. Array of exactly 5 objects:
[{ "name": "string", "base_description": "string", "icon": "emoji", "attribute_weights": { ${attributeIdMap} } }]`,
      messages: [
        {
          role: "user",
          content: `Generate 5 voter archetypes for: "${topicTitle}"`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `Anthropic API error: ${res.status} ${text}` },
      { status: 502 },
    );
  }

  const data = await res.json();
  const content = data.content?.[0]?.text;

  if (!content) {
    return NextResponse.json(
      { error: "No content in API response" },
      { status: 502 },
    );
  }

  try {
    const archetypes = JSON.parse(content);
    if (!Array.isArray(archetypes) || archetypes.length === 0) {
      throw new Error("Expected array of archetypes");
    }
    return NextResponse.json({ archetypes });
  } catch {
    return NextResponse.json(
      { error: "Failed to parse AI response as JSON", raw: content },
      { status: 502 },
    );
  }
}
