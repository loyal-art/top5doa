import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { OG_COLORS, OG_CONTENT_TYPE, OG_SIZE, clamp, ogFonts } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "A Top 5 on Top5DOA";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * SPOILER GATE — the growth-strategy call.
 *
 * How many of the five picks to reveal on the share card. At 1, the card
 * shows the #1 pick and blanks 2-5 behind "make your own list to see the
 * rest", so every share doubles as a referral prompt. Set to 5 to reveal the
 * whole list instead. This is the only line to change.
 */
const REVEAL_COUNT = 1;

interface Props {
  // Next.js 15: dynamic params are async everywhere, including image routes.
  params: Promise<{ username: string; topicSlug: string }>;
}

type ListRow = { rank_position: number; subjects: { name: string } | null };

export default async function Image({ params }: Props) {
  const { username, topicSlug } = await params;

  let displayName = username;
  let topicTitle = "";
  let picks: string[] = [];

  // The card must never hard-fail: a broken preview is worse than a generic
  // one. Any DB problem (including placeholder credentials in local dev)
  // falls through to the branded fallback below.
  try {
    const supabase = await createClient();

    const [{ data: profile }, { data: topic }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name")
        .eq("username", username)
        .single(),
      supabase.from("topics").select("id, title").eq("slug", topicSlug).single(),
    ]);

    if (profile && topic) {
      displayName = profile.display_name ?? profile.username;
      topicTitle = topic.title;

      const { data: rows } = await supabase
        .from("user_lists")
        .select("rank_position, subjects(name)")
        .eq("user_id", profile.id)
        .eq("topic_id", topic.id)
        .order("rank_position")
        .limit(5);

      picks = ((rows ?? []) as unknown as ListRow[])
        .map((r) => r.subjects?.name)
        .filter((n): n is string => Boolean(n));
    }
  } catch {
    // fall through to the branded fallback
  }

  const hiddenCount = Math.max(0, picks.length - REVEAL_COUNT);

  // No usable data (deleted list, or placeholder credentials in local dev):
  // fall back to the branded card rather than an empty skeleton.
  if (!topicTitle || picks.length === 0) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            backgroundColor: OG_COLORS.bg,
            padding: "80px",
          }}
        >
          <div
            style={{
              display: "flex",
              height: "8px",
              width: "160px",
              backgroundColor: OG_COLORS.accent,
              marginBottom: "44px",
            }}
          />
          <div style={{ display: "flex", fontSize: "88px", color: "#ffffff", letterSpacing: "-3px" }}>
            Top5DOA
          </div>
          <div style={{ display: "flex", fontSize: "40px", color: OG_COLORS.accent, marginTop: "20px" }}>
            What do you value?
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "30px",
              color: OG_COLORS.muted,
              marginTop: "24px",
              maxWidth: "900px",
              lineHeight: 1.35,
            }}
          >
            Rank what matters to you. We do the math, and hand you a Top 5 that
            is actually yours.
          </div>
        </div>
      ),
      { ...size, fonts: await ogFonts() },
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: OG_COLORS.bg,
          padding: "64px 72px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: "26px",
            color: OG_COLORS.accent,
            letterSpacing: "2px",
          }}
        >
          {clamp(displayName.toUpperCase(), 28)}
          {topicTitle ? `  ·  ${clamp(topicTitle.toUpperCase(), 34)}` : ""}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: "62px",
            color: "#ffffff",
            marginTop: "12px",
            letterSpacing: "-2px",
          }}
        >
          {topicTitle ? "My Top 5" : "Top5DOA"}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: "36px",
            gap: "14px",
          }}
        >
          {picks.slice(0, REVEAL_COUNT).map((name, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "24px" }}>
              <div
                style={{
                  display: "flex",
                  width: "62px",
                  height: "62px",
                  borderRadius: "12px",
                  backgroundColor: OG_COLORS.accent,
                  color: OG_COLORS.bg,
                  fontSize: "34px",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {i + 1}
              </div>
              <div style={{ display: "flex", fontSize: "48px", color: "#ffffff" }}>
                {clamp(name, 30)}
              </div>
            </div>
          ))}

          {Array.from({ length: hiddenCount }).map((_, i) => (
            <div key={`h${i}`} style={{ display: "flex", alignItems: "center", gap: "24px" }}>
              <div
                style={{
                  display: "flex",
                  width: "62px",
                  height: "62px",
                  borderRadius: "12px",
                  backgroundColor: OG_COLORS.surface,
                  border: `2px solid ${OG_COLORS.border}`,
                  color: OG_COLORS.muted,
                  fontSize: "34px",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {REVEAL_COUNT + i + 1}
              </div>
              <div
                style={{
                  display: "flex",
                  width: "440px",
                  height: "34px",
                  borderRadius: "8px",
                  backgroundColor: OG_COLORS.surface,
                  border: `2px solid ${OG_COLORS.border}`,
                }}
              />
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "auto",
            fontSize: "28px",
            color: hiddenCount > 0 ? OG_COLORS.accent : OG_COLORS.muted,
          }}
        >
          {hiddenCount > 0
            ? "Build your own list to see the rest →  top5doa"
            : "What do you value? →  top5doa"}
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
