import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const STYLE_DESCRIPTIONS: Record<string, string> = {
  cinematic: "dark dramatic lighting, gold particles, lens flares",
  comic: "bold ink lines, halftone dots, action energy",
  "sports-card": "metallic frame, holographic shimmer",
  editorial: "clean minimalist, magazine layout",
  tournament: "gritty, competitive, versus energy",
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
  const items = top5.slice(0, 5);
  const rank1 = items[0]?.name ?? "Unknown";
  const rank2 = items[1]?.name ?? "Unknown";
  const rank3 = items[2]?.name ?? "Unknown";
  const rank4 = items[3]?.name ?? "Unknown";
  const rank5 = items[4]?.name ?? "Unknown";

  return `Create a 1:1 square poster illustration. This is a ranking poster for an app called Top 5 DOA.

LAYOUT (follow this EXACTLY):
- Top 75%: The ranking content, illustration, and title go here
- Bottom 25%: Leave completely black/dark — this area will have a logo, user info, and app link overlaid later. Do NOT put any content here.

ILLUSTRATION — MOST IMPORTANT:
The #1 ranked subject "${rank1}" should have a large, dramatic, stylized cartoon caricature illustration or symbolic representation as the HERO of the poster. This is the centerpiece.
If the subject is a person, show a stylized non-identifiable cartoon caricature — exaggerated features, jersey number and team colors if applicable, dynamic action pose, energy effects — NOT a realistic likeness.
If the subject is a product (shoes, food, etc), show a large stylized illustrated version of the product with dramatic lighting and effects.
If the subject is abstract, show symbolic energy art.
The illustration should be large and visually dominant, positioned in the upper portion behind or above the ranking rows.

RANKING SECTION — SECOND MOST IMPORTANT:
Show exactly 5 ranking rows in the middle/lower portion of the top 75%. Each row MUST be fully visible — do NOT let any row get cut off. Each row has:
- A bold number (1-5) inside a colored square: 1=GOLD, 2=SILVER, 3=EMERALD GREEN, 4=TEAL, 5=STEEL BLUE
- The subject name in large white bold text to the right of the number
- Row 1: "${rank1}"
- Row 2: "${rank2}"
- Row 3: "${rank3}"
- Row 4: "${rank4}"
- Row 5: "${rank5}"
- Each row has a dark translucent background bar
- Rows are compact and evenly spaced

TITLE — LEAST IMPORTANT:
Show "${topicTitle}" in small metallic gold text above the rankings. Keep it subtle and compact — one line if possible, small font. The title should NOT compete with the illustration or rankings.

STYLE: ${styleDesc}

BACKGROUND: Dark cinematic atmosphere matching the style. Rich blacks, dramatic lighting. Gold/amber accent tones.

CRITICAL RULES:
- ALL 5 ranking rows MUST be fully visible and not cropped
- The illustration of #1 is the HERO — make it large and dramatic
- The title is small and subtle — do NOT make it large
- Leave bottom 25% completely dark and empty — NO content there
- Do NOT generate any logo, user profile info, or app link text in the image
- Do NOT generate realistic human faces or likenesses
- Use stylized cartoon caricatures for people-based subjects
- The poster should feel like a premium ESPN or sports media graphic`;
}

// BACKUP: GPT Image 1.5 version — revert to this if mini quality is insufficient
function buildPosterPromptV2(
  topicTitle: string,
  top5: { rank: number; name: string }[],
  styleDesc: string,
): string {
  const items = top5.slice(0, 5);
  const rank1 = items[0]?.name ?? "Unknown";
  const rank2 = items[1]?.name ?? "Unknown";
  const rank3 = items[2]?.name ?? "Unknown";
  const rank4 = items[3]?.name ?? "Unknown";
  const rank5 = items[4]?.name ?? "Unknown";

  return `Create a 1:1 square poster illustration. This is a ranking poster for an app called Top 5 DOA.

LAYOUT (follow this EXACTLY):
- Top 75%: The ranking content, illustration, and title go here
- Bottom 25%: Leave completely black/dark — this area will have a logo, user info, and app link overlaid later. Do NOT put any content here.

ILLUSTRATION — MOST IMPORTANT:
The #1 ranked subject "${rank1}" should have a large, dramatic, stylized cartoon caricature illustration or symbolic representation as the HERO of the poster. This is the centerpiece.
If the subject is a person, show a stylized non-identifiable cartoon caricature — exaggerated features, jersey number and team colors if applicable, dynamic action pose, energy effects — NOT a realistic likeness.
If the subject is a product (shoes, food, etc), show a large stylized illustrated version of the product with dramatic lighting and effects.
If the subject is abstract, show symbolic energy art.
The illustration should be large and visually dominant, positioned in the upper portion behind or above the ranking rows.

RANKING SECTION — SECOND MOST IMPORTANT:
Show exactly 5 ranking rows in the middle/lower portion of the top 75%. Each row MUST be fully visible — do NOT let any row get cut off. Each row has:
- A bold number (1-5) inside a colored square: 1=GOLD, 2=SILVER, 3=EMERALD GREEN, 4=TEAL, 5=STEEL BLUE
- The subject name in large white bold text to the right of the number
- Row 1: "${rank1}"
- Row 2: "${rank2}"
- Row 3: "${rank3}"
- Row 4: "${rank4}"
- Row 5: "${rank5}"
- Each row has a dark translucent background bar
- Rows are compact and evenly spaced

TITLE — LEAST IMPORTANT:
Show "${topicTitle}" in small metallic gold text above the rankings. Keep it subtle and compact — one line if possible, small font. The title should NOT compete with the illustration or rankings.

STYLE: ${styleDesc}

BACKGROUND: Dark cinematic atmosphere matching the style. Rich blacks, dramatic lighting. Gold/amber accent tones.

CRITICAL RULES:
- ALL 5 ranking rows MUST be fully visible and not cropped
- The illustration of #1 is the HERO — make it large and dramatic
- The title is small and subtle — do NOT make it large
- Leave bottom 25% completely dark and empty — NO content there
- Do NOT generate any logo, user profile info, or app link text in the image
- Do NOT generate realistic human faces or likenesses
- Use stylized cartoon caricatures for people-based subjects
- The poster should feel like a premium ESPN or sports media graphic`;
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

  // Helper to call the OpenAI image generation API
  async function callOpenAI(prompt: string) {
    return fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1-mini",
        prompt,
        size: "1024x1024",
        quality: "medium",
      }),
    });
  }

  function isModerationBlocked(status: number, body: string): boolean {
    // OpenAI uses various error formats for content policy rejections
    const lower = body.toLowerCase();
    return (
      lower.includes("moderation") ||
      lower.includes("content_policy") ||
      lower.includes("safety_system") ||
      lower.includes("safety system") ||
      lower.includes("rejected") ||
      lower.includes("not allowed") ||
      lower.includes("policy violation") ||
      lower.includes("content policy")
    );
  }

  // First attempt with the original prompt
  let openaiRes = await callOpenAI(imagePrompt);
  let fallbackUsed = false;

  if (!openaiRes.ok) {
    const text = await openaiRes.text();
    console.error(`[generate-poster] OpenAI error (${openaiRes.status}):`, text.slice(0, 500));

    if (isBillingError(openaiRes.status, text)) {
      await notifyAdmins("OpenAI");
      return NextResponse.json({ error: USER_FRIENDLY_UNAVAILABLE }, { status: 503 });
    }

    // Moderation blocked — retry with a completely sanitized fallback prompt
    // The AI generates only an abstract background; real names/title are overlaid by the client
    if (isModerationBlocked(openaiRes.status, text)) {
      console.log("[generate-poster] Moderation blocked, retrying with safe abstract fallback...");
      const fallbackPrompt = `Create a 1:1 square ranking poster with a dark cinematic background, gold particles, and dramatic lighting. Show 5 ranking rows with numbers 1-5 in colored squares (gold, silver, green, teal, blue) and placeholder text: RANK 1, RANK 2, RANK 3, RANK 4, RANK 5. Each row has a dark translucent bar. Leave the bottom 25% dark and empty. Style: ${styleDesc}. Do NOT include any people, faces, characters, or likenesses. The poster should feel like a premium ESPN or sports media graphic with dramatic energy effects and rich blacks.`;

      openaiRes = await callOpenAI(fallbackPrompt);
      if (!openaiRes.ok) {
        const fallbackText = await openaiRes.text();
        console.error(`[generate-poster] Fallback also failed (${openaiRes.status}):`, fallbackText.slice(0, 500));

        if (isBillingError(openaiRes.status, fallbackText)) {
          await notifyAdmins("OpenAI");
          return NextResponse.json({ error: USER_FRIENDLY_UNAVAILABLE }, { status: 503 });
        }

        // Both attempts failed — user-friendly error
        return NextResponse.json(
          { error: "Poster generation unavailable for this topic. Try a different style!" },
          { status: 502 }
        );
      }
      fallbackUsed = true;
    } else {
      // Non-moderation, non-billing error — user-friendly message
      return NextResponse.json(
        { error: "Poster generation unavailable for this topic. Try a different style!" },
        { status: 502 }
      );
    }
  }

  const openaiData = await openaiRes.json();
  const imageData = openaiData.data?.[0];

  if (!imageData) {
    return NextResponse.json(
      { error: "Poster generation unavailable for this topic. Try a different style!" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    imageUrl: imageData.url ?? null,
    imageBase64: imageData.b64_json ?? null,
    prompt: imagePrompt,
    fallbackUsed,
  });
}
