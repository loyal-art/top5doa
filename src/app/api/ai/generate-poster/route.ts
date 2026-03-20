import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const STYLE_DESCRIPTIONS: Record<string, string> = {
  comic: "Marvel comic book splash page with dramatic lighting, bold outlines, and action poses",
  anime: "dramatic anime battle scene with dynamic energy effects, speed lines, and epic composition",
  classic: "renaissance oil painting with dramatic chiaroscuro lighting and classical composition",
  sports: "ESPN magazine cover with bold typography, dramatic athlete poses, and stadium lighting",
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

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  const styleDesc = STYLE_DESCRIPTIONS[style] ?? STYLE_DESCRIPTIONS.comic;

  // Step 1: Generate image prompt via Claude
  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You are an expert art director. Generate a detailed image generation prompt for a dramatic poster showing a Top 5 ranking. The #1 item should be the hero/centerpiece. The style should be: ${styleDesc}. Include the topic title "${topicTitle}" as text at the top. Make it bold, dynamic, and social-media worthy. Do NOT include any real people's faces or likenesses. Return ONLY the image prompt text, nothing else.`,
      messages: [
        {
          role: "user",
          content: `Create a poster image prompt for this Top 5 list:\n\nTopic: ${topicTitle}\n\n${top5.map((item) => `#${item.rank} - ${item.name}`).join("\n")}\n\nBy: @${username} (${tier} tier, ${aura} Aura)`,
        },
      ],
    }),
  });

  if (!claudeRes.ok) {
    const text = await claudeRes.text();

    if (isBillingError(claudeRes.status, text)) {
      await notifyAdmins("Anthropic");
      return NextResponse.json({ error: USER_FRIENDLY_UNAVAILABLE }, { status: 503 });
    }

    return NextResponse.json(
      { error: `Claude API error: ${claudeRes.status} ${text}` },
      { status: 502 }
    );
  }

  const claudeData = await claudeRes.json();
  const imagePrompt = claudeData.content?.[0]?.text;

  if (!imagePrompt) {
    return NextResponse.json({ error: "No prompt generated from Claude" }, { status: 502 });
  }

  // Step 2: Generate image via OpenAI
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
