import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const STYLE_DESCRIPTIONS: Record<string, string> = {
  comic: "Marvel comic book splash page with dramatic lighting, bold outlines, energy effects, and vibrant colors",
  anime: "dramatic anime battle scene with dynamic energy effects, speed lines, and epic composition",
  classic: "renaissance oil painting with dramatic chiaroscuro lighting and classical composition",
  sports: "ESPN magazine cover with bold typography, dramatic spotlight lighting, and stadium atmosphere",
  meme: "exaggerated cartoon style with over-the-top expressions, bright colors, and meme energy",
};

const USER_FRIENDLY_UNAVAILABLE =
  "AI Poster generation is temporarily unavailable. Please try again later.";

function isBillingError(status: number, body: string): boolean {
  if (status === 402) return true;
  if (status === 429 && body.includes("insufficient_quota")) return true;
  if (status === 400 && body.includes("billing_hard_limit_reached")) return true;
  if (body.includes("insufficient_quota") || body.includes("billing_hard_limit_reached"))
    return true;
  return false;
}

async function notifyAdmins(service: string) {
  try {
    const supabase = await createClient();
    const { data: admins } = await supabase
      .from("profiles")
      .select("id")
      .eq("is_admin", true);

    if (!admins?.length) return;

    const platformUrl =
      service === "OpenAI"
        ? "platform.openai.com"
        : "console.anthropic.com";

    const rows = admins.map((admin) => ({
      user_id: admin.id,
      type: "billing_alert",
      title: `${service} API Billing Alert`,
      message: `ALERT: ${service} API billing limit reached. Add credits at ${platformUrl}`,
    }));

    await supabase.from("notifications").insert(rows);
  } catch (err) {
    console.error(`[generate-poster] Failed to notify admins about ${service} billing:`, err);
  }
}

function buildPosterPrompt(
  topicTitle: string,
  top5: { rank: number; name: string }[],
  username: string,
  tier: string,
  aura: number,
  styleDesc: string,
): string {
  const rankColors = ["gold", "silver", "green", "teal", "blue"];
  const rankingLines = top5
    .slice(0, 5)
    .map((item, i) => {
      const color = rankColors[i] ?? "blue";
      return `Row ${item.rank}: A large metallic "${item.rank}" number on the left inside a ${color} colored box, with "${item.name}" in white bold text to the right. Each row has a dark translucent background bar with a subtle ${color}-tinted border.`;
    })
    .join("\n");

  return `Create a polished, professional ranking poster image. Style: ${styleDesc}.

Background: dark space/galaxy theme with gold particle effects and subtle lens flares.

At the top center, show a metallic gold shield emblem with "TOP 5" text inside it.

Below that, display the title "${topicTitle}" in bold metallic gold text, centered. A horizontal gold glowing line separates the title from the rankings below.

Show 5 ranking rows stacked vertically:
${rankingLines}

At the bottom left, show a circular avatar frame with the letter "${(username || "?").charAt(0).toUpperCase()}" inside, next to the text "${username}" and a tier badge showing "${tier} • ${aura.toLocaleString()} Aura".

At the bottom right, show "TOP5DOA.APP" in bright yellow neon glowing text.

The overall style should look like a premium ESPN or Spotify Wrapped graphic — cinematic, editorial, and social-media ready. Make the text crisp and readable. Do NOT include any real human faces or likenesses. Use abstract/symbolic imagery only.`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { topicTitle, top5, username, tier, aura, style } = body as {
    topicTitle: string;
    top5: { rank: number; name: string }[];
    username: string;
    tier: string;
    aura: number;
    style: string;
  };

  if (!topicTitle || !top5?.length || !style) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  const styleDesc = STYLE_DESCRIPTIONS[style] ?? STYLE_DESCRIPTIONS.comic;

  // Build the fully-detailed poster prompt with all text/rankings/branding baked in
  const imagePrompt = buildPosterPrompt(topicTitle, top5, username, tier, aura, styleDesc);

  // Generate image via OpenAI gpt-image-1-mini with full text instructions
  const openaiRes = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1-mini",
      prompt: imagePrompt,
      size: "1024x1024",
      quality: "medium",
    }),
  });

  if (!openaiRes.ok) {
    const text = await openaiRes.text();

    if (isBillingError(openaiRes.status, text)) {
      await notifyAdmins("OpenAI");
      return NextResponse.json({ error: USER_FRIENDLY_UNAVAILABLE }, { status: 503 });
    }

    return NextResponse.json(
      { error: `OpenAI API error: ${openaiRes.status} ${text}` },
      { status: 502 }
    );
  }

  const openaiData = await openaiRes.json();
  const imageData = openaiData.data?.[0];

  if (!imageData) {
    return NextResponse.json({ error: "No image generated from OpenAI" }, { status: 502 });
  }

  return NextResponse.json({
    imageUrl: imageData.url ?? null,
    imageBase64: imageData.b64_json ?? null,
    prompt: imagePrompt,
  });
}
