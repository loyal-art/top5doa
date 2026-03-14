import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { topicTitle, subjects } = await req.json();

  if (!topicTitle || typeof topicTitle !== "string") {
    return NextResponse.json({ error: "topicTitle is required" }, { status: 400 });
  }

  if (!Array.isArray(subjects) || subjects.length === 0) {
    return NextResponse.json({ error: "subjects array is required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 },
    );
  }

  const subjectList = subjects
    .map((s: { id: string; name: string }) => `- id: "${s.id}", name: "${s.name}"`)
    .join("\n");

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
        "For each song name and topic context, construct a YouTube search URL in the format: https://www.youtube.com/results?search_query={song+title}+{artist}+official+audio. URL-encode the search_query parameter properly. Return ONLY valid JSON with no markdown: { \"links\": [{ \"id\": \"string\", \"name\": \"string\", \"musicUrl\": \"string\" }] }",
      messages: [
        {
          role: "user",
          content: `Generate YouTube search URLs for each of these subjects in the context of the topic "${topicTitle}":\n\n${subjectList}`,
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
    const parsed = JSON.parse(content);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse AI response as JSON", raw: content },
      { status: 502 },
    );
  }
}
