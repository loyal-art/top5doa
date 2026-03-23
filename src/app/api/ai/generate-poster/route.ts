import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fal } from "@fal-ai/client";

// ── Constants ────────────────────────────────────────────────────────────────

const STYLE_DESCRIPTIONS: Record<string, string> = {
  cinematic: "dark dramatic lighting, gold particles, lens flares",
  comic: "bold ink lines, halftone dots, action energy",
  "sports-card": "metallic frame, holographic shimmer",
  editorial: "clean minimalist, magazine layout",
  tournament: "gritty, competitive, versus energy",
};

const USER_FRIENDLY_UNAVAILABLE =
  "AI Poster generation is temporarily unavailable. Please try again later.";

/** Timeout for FLUX requests (30 seconds) before falling back to OpenAI. */
const FLUX_TIMEOUT_MS = 30_000;

/** Timeout for the visual description pre-pass (8 seconds). */
const VISUAL_DESC_TIMEOUT_MS = 8_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

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
        : service === "fal.ai"
          ? "fal.ai/dashboard"
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

function isModerationBlocked(status: number, body: string): boolean {
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

// ── Visual Description Pre-Pass ──────────────────────────────────────────────
// Uses Claude to generate a rich visual description of the #1 subject so the
// image generator produces a recognizable illustration without using the name.

async function generateVisualDescription(
  subjectName: string,
  topicTitle: string,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("[generate-poster] ANTHROPIC_API_KEY not set, skipping visual description");
    return null;
  }

  try {
    const result = await Promise.race([
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 256,
          messages: [
            {
              role: "user",
              content: `You are a visual director. Given the subject "${subjectName}" from the topic "${topicTitle}", write a 2-3 sentence visual description for an AI image generator. Describe their physical appearance, iconic clothing/uniform details (team colors, jersey number, era, accessories), signature pose or action, and any iconic visual elements. Be specific about colors, build, and style. Do NOT use their name in the description — only visual details. Example: Instead of "Drew Brees" write "NFL quarterback in New Orleans Saints uniform, gold helmet with fleur-de-lis, black and gold colors, number 9, compact athletic build, throwing motion from the pocket, intense focus." Return ONLY the visual description, nothing else.`,
            },
          ],
        }),
      }).then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          console.error(`[generate-poster] Visual description API error (${res.status}):`, text.slice(0, 200));
          return null;
        }
        const data = await res.json();
        const text = data.content?.[0]?.text;
        if (!text) return null;
        console.log("[generate-poster] Visual description generated:", text.slice(0, 100));
        return text.trim();
      }),
      new Promise<null>((resolve) =>
        setTimeout(() => {
          console.log("[generate-poster] Visual description timed out");
          resolve(null);
        }, VISUAL_DESC_TIMEOUT_MS)
      ),
    ]);

    return result;
  } catch (err) {
    console.error("[generate-poster] Visual description failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Prompt builders ──────────────────────────────────────────────────────────
// AI generates ONLY visual art. All text, rankings, logos, and branding are
// overlaid by the client via html2canvas on the poster-composite-card element.

function buildPosterPrompt(
  topicTitle: string,
  top5: { rank: number; name: string }[],
  styleDesc: string,
  visualDescription?: string | null,
): string {
  const rank1 = top5[0]?.name ?? "Unknown";

  // Use the rich visual description if available, otherwise fall back to the name
  const heroDescription = visualDescription
    ? `The #1 ranked subject is: ${visualDescription}`
    : `The subject is "${rank1}" in the context of "${topicTitle}". If the subject is a person, show a stylized cartoon caricature in action — exaggerated features, team colors/jersey if applicable, energy effects. NOT a realistic likeness. If the subject is a product (shoes, food, etc), show it dramatically lit with stylized effects. If the subject is a song, movie, or abstract concept, show symbolic/thematic imagery that captures its energy.`;

  return `Create a square poster background illustration. This is art for a ranking poster app.

TOP 60% — HERO ILLUSTRATION:
${heroDescription}
Create a dramatic, dynamic, stylized illustration of this subject as the hero centerpiece.
The hero illustration should be large, bold, and visually dominant in the upper portion.

BOTTOM 40% — DARK GRADIENT:
Must be a simple dark gradient fading to near-black. Solid, low-detail, no illustration content.
This area will have text overlaid later — it MUST be dark and simple for readability.

STYLE: ${styleDesc} — premium cinematic lighting, gold/amber accents, high contrast, dramatic energy.

CRITICAL RULES:
- Do NOT include ANY text, words, letters, numbers, ranking rows, logos, labels, titles, or UI elements ANYWHERE in the image
- Do NOT include any written content of any kind
- Do NOT generate realistic human faces or likenesses — use stylized cartoon caricatures only
- Leave strong negative space in the lower portion — dark, simple, gradient to black
- The poster should feel like premium ESPN or sports media art`;
}

// BACKUP: Abstract-only fallback prompt for moderation-blocked topics
function buildFallbackPrompt(styleDesc: string): string {
  return `Create a square poster background illustration with a dark cinematic atmosphere.
The image should feature dramatic abstract energy effects, gold particles, and premium lighting.
Top 60%: Dynamic abstract art with bold shapes, dramatic lighting, and cinematic atmosphere.
Bottom 40%: Dark gradient fading to near-black, simple and clean.
Style: ${styleDesc} — premium cinematic lighting, gold/amber accents, high contrast.
Do NOT include ANY text, words, people, faces, characters, or likenesses anywhere.
Do NOT include any written content, numbers, or UI elements.`;
}

// BACKUP: GPT Image 1.5 version — revert to this if mini quality is insufficient
function buildPosterPromptV2(
  topicTitle: string,
  top5: { rank: number; name: string }[],
  styleDesc: string,
): string {
  return buildPosterPrompt(topicTitle, top5, styleDesc);
}

// ── Provider: fal.ai FLUX ────────────────────────────────────────────────────

async function tryFlux(
  prompt: string,
): Promise<{ imageUrl: string } | null> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    console.log("[generate-poster] FAL_KEY not set, skipping FLUX");
    return null;
  }

  fal.config({ credentials: falKey });

  try {
    // Race the FLUX call against a timeout to prevent stalling the request
    const result = await Promise.race([
      fal.subscribe("fal-ai/flux/dev", {
        input: {
          prompt,
          image_size: "square" as const,
          num_images: 1,
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("FLUX timeout")), FLUX_TIMEOUT_MS)
      ),
    ]);

    const imageUrl =
      (result as { data: { images?: { url: string }[] } }).data?.images?.[0]?.url;

    if (!imageUrl) {
      console.error("[generate-poster] FLUX returned no image URL");
      return null;
    }

    console.log("[generate-poster] FLUX success");
    return { imageUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generate-poster] FLUX failed:", msg);

    // Check for billing-style errors from fal.ai
    if (msg.includes("402") || msg.includes("quota") || msg.includes("billing")) {
      await notifyAdmins("fal.ai");
    }

    return null;
  }
}

// ── Provider: OpenAI ─────────────────────────────────────────────────────────

async function tryOpenAI(
  imagePrompt: string,
  styleDesc: string,
  openaiKey: string,
): Promise<{ imageUrl: string | null; imageBase64: string | null; fallbackUsed: boolean } | null> {
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

  // First attempt with the original prompt
  let openaiRes = await callOpenAI(imagePrompt);
  let fallbackUsed = false;

  if (!openaiRes.ok) {
    const text = await openaiRes.text();
    console.error(`[generate-poster] OpenAI error (${openaiRes.status}):`, text.slice(0, 500));

    if (isBillingError(openaiRes.status, text)) {
      await notifyAdmins("OpenAI");
      return null; // let caller return 503
    }

    // Moderation blocked — retry with sanitized abstract-only fallback
    if (isModerationBlocked(openaiRes.status, text)) {
      console.log("[generate-poster] OpenAI moderation blocked, retrying with safe abstract fallback...");

      openaiRes = await callOpenAI(buildFallbackPrompt(styleDesc));
      if (!openaiRes.ok) {
        const fallbackText = await openaiRes.text();
        console.error(`[generate-poster] OpenAI fallback also failed (${openaiRes.status}):`, fallbackText.slice(0, 500));
        if (isBillingError(openaiRes.status, fallbackText)) {
          await notifyAdmins("OpenAI");
        }
        return null;
      }
      fallbackUsed = true;
    } else {
      return null;
    }
  }

  const openaiData = await openaiRes.json();
  const imageData = openaiData.data?.[0];
  if (!imageData) return null;

  console.log("[generate-poster] OpenAI success (fallback=%s)", fallbackUsed);
  return {
    imageUrl: imageData.url ?? null,
    imageBase64: imageData.b64_json ?? null,
    fallbackUsed,
  };
}

// ── Route handler ────────────────────────────────────────────────────────────

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
  const falKey = process.env.FAL_KEY;

  // At least one image provider must be available
  if (!openaiKey && !falKey) {
    return NextResponse.json(
      { error: "No image generation API keys configured" },
      { status: 500 },
    );
  }

  const styleDesc = STYLE_DESCRIPTIONS[style] ?? STYLE_DESCRIPTIONS.comic;
  const rank1Name = top5[0]?.name ?? "Unknown";

  // ── 0. Generate visual description of #1 subject via Claude ──────────────
  // This gives the image generator rich visual details (uniform, colors, pose)
  // instead of just a name, producing far more recognizable illustrations.
  const visualDescription = await generateVisualDescription(rank1Name, topicTitle);

  const imagePrompt = buildPosterPrompt(topicTitle, top5, styleDesc, visualDescription);

  // ── 1. Try fal.ai FLUX (primary) ────────────────────────────────────────
  const fluxResult = await tryFlux(imagePrompt);
  if (fluxResult) {
    return NextResponse.json({
      imageUrl: fluxResult.imageUrl,
      imageBase64: null,
      prompt: imagePrompt,
      fallbackUsed: false,
      visualDescription: visualDescription ?? null,
    });
  }

  // ── 2. Try OpenAI (secondary fallback) ──────────────────────────────────
  if (openaiKey) {
    const openaiResult = await tryOpenAI(imagePrompt, styleDesc, openaiKey);
    if (openaiResult) {
      return NextResponse.json({
        imageUrl: openaiResult.imageUrl,
        imageBase64: openaiResult.imageBase64,
        prompt: imagePrompt,
        fallbackUsed: openaiResult.fallbackUsed,
        visualDescription: visualDescription ?? null,
      });
    }
  }

  // ── 3. Both failed — 502 triggers client-side share-card fallback ──────
  return NextResponse.json(
    { error: "Poster generation unavailable for this topic. Try a different style!" },
    { status: 502 },
  );
}
