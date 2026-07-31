import { ImageResponse } from "next/og";
import { OG_COLORS, OG_CONTENT_TYPE, OG_SIZE, ogFonts } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "Top5DOA — what do you value?";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Default share card, inherited by every page without its own image. */
export default async function Image() {
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
            marginBottom: "48px",
          }}
        />
        <div
          style={{
            display: "flex",
            fontSize: "104px",
            color: "#ffffff",
            letterSpacing: "-3px",
            lineHeight: 1.05,
          }}
        >
          Top5DOA
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "44px",
            color: OG_COLORS.accent,
            marginTop: "24px",
          }}
        >
          What do you value?
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "30px",
            color: OG_COLORS.muted,
            marginTop: "28px",
            maxWidth: "900px",
            lineHeight: 1.35,
          }}
        >
          Rank what matters to you. We do the math. Two people can score every
          contender the same and still get different Top 5s.
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
