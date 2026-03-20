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
  styleDesc: string,
): string {
  const rankColors = ["gold", "silver", "emerald", "teal", "blue"];
  const items = top5.slice(0, 5);
  const firstName = items[0]?.name ?? "Unknown";

  const rankingRows = items
    .map((item, i) => {
      const color = rankColors[i] ?? "blue";
      return `  Row ${item.rank}: Large bold number "${item.rank}" in a ${color}-colored square on the left, then "${item.name}" in large white bold text to the right. Dark translucent background bar with a subtle ${color}-tinted border.`;
    })
    .join("\n");

  return `Create a 1:1 square poster image with ALL content fitting within the frame with generous padding on all sides. Style: ${styleDesc}. Dark cinematic background with subtle gold particles and lens flares.

Layout from top to bottom with clear spacing between each section:

TOP AREA (top 12% of image): Leave this area as plain dark background with subtle atmosphere only. Do NOT place any logo, emblem, shield, or text here — a real logo will be overlaid later.

TITLE SECTION: Below the top area, show "${topicTitle}" in large bold metallic gold text, centered. A horizontal gold glowing line separates the title from the content below.

MIDDLE SECTION: A SMALL, SUBTLE visual representation of the #1 ranked item "${firstName}" — if it is a product show a small version of the product, if it is a person show a subtle dramatic silhouette with energy effects, if it is a place show a faint scenic view. This visual must be a SMALL background element behind the ranking rows — NOT a large centerpiece. It should be faded/transparent so it does not compete with the ranking text.

RANKING SECTION: 5 compact horizontal rows with dark translucent backgrounds, evenly spaced. The ranking rows should take up approximately 50% of the total image height. Each row should be compact — just tall enough for the number and text, not oversized:
${rankingRows}

BOTTOM AREA (bottom 12% of image): Leave this area as dark space — do NOT generate any username, avatar, app name, watermark, URL, or branding text here. This area will have content overlaid later. Just keep it dark/atmospheric.

CRITICAL: All 5 ranking rows MUST be fully visible within the image. Keep the #1 subject visual art SMALL — it should be a subtle background element behind the rankings, NOT a large centerpiece that pushes rankings off screen. The ranking rows should take up approximately 50% of the image height. Each row should be compact — just tall enough for the number and text. Leave the top 12% empty for logo overlay and the bottom 12% empty for user info overlay. Everything must fit inside the square frame. Leave at least 40px padding on all edges. Do not crop any text or elements. The poster must look complete and polished like a premium ESPN or Spotify Wrapped graphic. Do NOT include any real human faces.`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { topicTitle, top5, displayName, username, tier, aura, style } = body as {
    topicTitle: string;
    top5: { rank: number; name: string }[];
    displayName: string;
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

  // Build the poster prompt — AI renders title + rankings + art; we overlay logo/user/branding
  const imagePrompt = buildPosterPrompt(topicTitle, top5, styleDesc);

  // Generate image via OpenAI gpt-image-1-mini with full text instructions
  const openaiRes = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
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
