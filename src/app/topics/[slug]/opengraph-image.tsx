import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { OG_COLORS, OG_CONTENT_TYPE, OG_SIZE, clamp, ogFonts } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "A debate topic on Top5DOA";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: Props) {
  const { slug } = await params;

  let title = "Top5DOA";
  let attributeNames: string[] = [];

  try {
    const supabase = await createClient();

    const { data: topic } = await supabase
      .from("topics")
      .select("id, title")
      .eq("slug", slug)
      .eq("status", "active")
      .single();

    if (topic) {
      title = topic.title;

      const { data: attrs } = await supabase
        .from("attributes")
        .select("name")
        .eq("topic_id", topic.id)
        .eq("status", "active")
        .limit(5);

      attributeNames = (attrs ?? [])
        .map((a: { name: string | null }) => a.name)
        .filter((n): n is string => Boolean(n));
    }
  } catch {
    // fall through to the branded fallback
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
          padding: "70px 72px",
        }}
      >
        <div
          style={{
            display: "flex",
            height: "8px",
            width: "140px",
            backgroundColor: OG_COLORS.accent,
          }}
        />

        <div
          style={{
            display: "flex",
            fontSize: "72px",
            color: "#ffffff",
            marginTop: "36px",
            letterSpacing: "-2px",
            lineHeight: 1.1,
            maxWidth: "1000px",
          }}
        >
          {clamp(title, 60)}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: "34px",
            color: OG_COLORS.accent,
            marginTop: "26px",
          }}
        >
          Rank these by what matters to you:
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "14px",
            marginTop: "26px",
            maxWidth: "1050px",
          }}
        >
          {attributeNames.map((name, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                padding: "12px 24px",
                borderRadius: "999px",
                backgroundColor: OG_COLORS.surface,
                border: `2px solid ${OG_COLORS.border}`,
                color: "#ffffff",
                fontSize: "28px",
              }}
            >
              {clamp(name, 22)}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "auto",
            fontSize: "28px",
            color: OG_COLORS.muted,
          }}
        >
          Your values. Your Top 5. →  top5doa
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
