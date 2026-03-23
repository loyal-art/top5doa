import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

// ── Font cache ───────────────────────────────────────────────────────────────
// Fonts are fetched once then held in module-scope memory for the process lifetime.

let bebasNeueFont: ArrayBuffer | null = null;
let dmSansFont: ArrayBuffer | null = null;

async function loadFonts() {
  if (!bebasNeueFont) {
    const bebasRes = await fetch(
      "https://fonts.gstatic.com/s/bebasneue/v14/JTUSjIg69CK48gW7PXoo9Wlhyw.woff2"
    );
    bebasNeueFont = await bebasRes.arrayBuffer();
  }
  if (!dmSansFont) {
    const dmRes = await fetch(
      "https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZOIHTWEBlwu8Q.woff2"
    );
    dmSansFont = await dmRes.arrayBuffer();
  }
  return { bebasNeue: bebasNeueFont, dmSans: dmSansFont };
}

// ── Types ────────────────────────────────────────────────────────────────────

interface CompositeRequest {
  aiImageUrl: string;
  topicTitle: string;
  top5: { rank: number; name: string }[];
  username: string;
  displayName: string;
  tier: string;
  tierColor: string;
  aura: number;
  archetype?: { icon: string; name: string; secondary?: string };
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CompositeRequest;
  const {
    aiImageUrl,
    topicTitle,
    top5,
    username,
    displayName,
    tier,
    tierColor,
    aura,
    archetype,
  } = body;

  if (!aiImageUrl || !topicTitle || !top5?.length) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Load fonts in parallel with AI image fetch
  const [fonts, aiImageRes] = await Promise.all([
    loadFonts(),
    fetch(aiImageUrl).then((r) => r.arrayBuffer()),
  ]);

  const aiImageBase64 = `data:image/png;base64,${Buffer.from(aiImageRes).toString("base64")}`;

  // Tier glow color parsing for badge
  const safeColor = tierColor === "rainbow" ? "#ffffff" : tierColor || "#6b7280";

  const RANK_COLORS = ["#FFD700", "#C0C0C0", "#10B981", "#14B8A6", "#3B82F6"];

  const initial = (displayName || username || "?").charAt(0).toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: "1080px",
          height: "1080px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          fontFamily: "DM Sans",
          overflow: "hidden",
        }}
      >
        {/* AI art background */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={aiImageBase64}
          width={1080}
          height={1080}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "1080px",
            height: "1080px",
            objectFit: "cover",
          }}
        />

        {/* Dark gradient overlay — bottom 60% for text readability */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "650px",
            display: "flex",
            background:
              "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.5) 70%, transparent 100%)",
          }}
        />

        {/* ── TOP ZONE: Topic title ── */}
        <div
          style={{
            position: "absolute",
            top: "36px",
            left: "48px",
            right: "48px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontFamily: "Bebas Neue",
              fontSize: "28px",
              color: "#FFD700",
              letterSpacing: "3px",
              textTransform: "uppercase" as const,
              lineHeight: 1.2,
              textShadow: "0 2px 12px rgba(0,0,0,0.9), 0 0 24px rgba(0,0,0,0.7)",
              display: "flex",
            }}
          >
            {topicTitle.toUpperCase()}
          </div>
          <div
            style={{
              fontFamily: "Bebas Neue",
              fontSize: "14px",
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "4px",
              textTransform: "uppercase" as const,
              marginTop: "6px",
              display: "flex",
              textShadow: "0 1px 8px rgba(0,0,0,0.9)",
            }}
          >
            MY TOP 5
          </div>
        </div>

        {/* ── MIDDLE ZONE: Ranking rows ── */}
        <div
          style={{
            position: "absolute",
            left: "48px",
            right: "48px",
            top: "420px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {top5.slice(0, 5).map((item, idx) => {
            const rankColor = RANK_COLORS[idx] ?? "#3B82F6";
            const isFirst = idx === 0;
            const nameLen = item.name.length;
            const fontSize = nameLen > 45 ? 20 : nameLen > 30 ? 24 : 36;
            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  background: "rgba(0,0,0,0.6)",
                  borderRadius: "12px",
                  padding: isFirst ? "14px 20px" : "10px 20px",
                  border: isFirst
                    ? "1px solid rgba(255,215,0,0.3)"
                    : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {/* Rank square */}
                <div
                  style={{
                    width: isFirst ? "56px" : "48px",
                    height: isFirst ? "56px" : "48px",
                    borderRadius: "10px",
                    background: rankColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "Bebas Neue",
                      fontSize: isFirst ? "36px" : "30px",
                      color: idx <= 1 ? "#000000" : "#ffffff",
                      lineHeight: 1,
                      display: "flex",
                    }}
                  >
                    {idx + 1}
                  </div>
                </div>
                {/* Subject name */}
                <div
                  style={{
                    fontSize: `${fontSize}px`,
                    fontWeight: 800,
                    color: "#ffffff",
                    letterSpacing: "0.5px",
                    flex: 1,
                    paddingLeft: "20px",
                    lineHeight: 1.2,
                    display: "flex",
                    textShadow: "0 2px 10px rgba(0,0,0,0.8)",
                    overflow: "hidden",
                  }}
                >
                  {item.name}
                </div>
              </div>
            );
          })}

          {/* Archetype badge — below ranking rows */}
          {archetype && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: "6px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "rgba(0,0,0,0.6)",
                  border: "1px solid rgba(255,215,0,0.25)",
                  borderRadius: "10px",
                  padding: "8px 18px",
                }}
              >
                <div style={{ fontSize: "22px", display: "flex" }}>
                  {archetype.icon}
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      fontFamily: "Bebas Neue",
                      fontSize: "18px",
                      color: "#FFD700",
                      letterSpacing: "2px",
                      lineHeight: 1.2,
                      display: "flex",
                    }}
                  >
                    {archetype.name.toUpperCase()}
                  </div>
                  {archetype.secondary && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#a78bfa",
                        marginTop: "1px",
                        display: "flex",
                      }}
                    >
                      {archetype.secondary}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── BOTTOM CENTER: Logo ── */}
        <div
          style={{
            position: "absolute",
            bottom: "90px",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${getBaseUrl(req)}/images/logo-full.png`}
            height={200}
            style={{ height: "200px", objectFit: "contain" }}
          />
        </div>

        {/* ── BOTTOM ZONE: User info (left) + branding (right) ── */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "0 48px 36px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          {/* User info */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Avatar circle */}
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #2a2a2a, #1a1a1a)",
                border: `2px solid ${safeColor}`,
                boxShadow: `0 0 16px ${safeColor}66`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  fontFamily: "Bebas Neue",
                  fontSize: "24px",
                  color: "#FFD700",
                  lineHeight: 1,
                  display: "flex",
                }}
              >
                {initial}
              </div>
            </div>

            {/* Name + username + tier + aura */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              {displayName && (
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "#ffffff",
                    lineHeight: 1.2,
                    display: "flex",
                    textShadow: "0 1px 6px rgba(0,0,0,0.9)",
                  }}
                >
                  {displayName}
                </div>
              )}
              {username && (
                <div
                  style={{
                    fontSize: "14px",
                    color: "#999999",
                    fontWeight: 400,
                    display: "flex",
                    textShadow: "0 1px 4px rgba(0,0,0,0.9)",
                  }}
                >
                  @{username}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginTop: "2px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 800,
                    color: "#ffffff",
                    background: `${safeColor}59`,
                    border: `1px solid ${safeColor}b3`,
                    borderRadius: "5px",
                    padding: "3px 10px",
                    textTransform: "uppercase" as const,
                    letterSpacing: "1.5px",
                    display: "flex",
                  }}
                >
                  {tier}
                </div>
                <div
                  style={{
                    fontFamily: "Bebas Neue",
                    fontSize: "16px",
                    color: safeColor,
                    letterSpacing: "2px",
                    display: "flex",
                    textShadow: `0 0 10px ${safeColor}80`,
                  }}
                >
                  {aura.toLocaleString()} AURA
                </div>
              </div>
            </div>
          </div>

          {/* TOP5DOA.APP branding */}
          <div
            style={{
              fontFamily: "Bebas Neue",
              fontSize: "28px",
              color: "#e8ff00",
              fontWeight: 700,
              letterSpacing: "3px",
              display: "flex",
              textShadow: "0 0 20px rgba(232,255,0,0.4)",
            }}
          >
            TOP5DOA.APP
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      fonts: [
        { name: "Bebas Neue", data: fonts.bebasNeue, style: "normal", weight: 400 },
        { name: "DM Sans", data: fonts.dmSans, style: "normal", weight: 400 },
      ],
    }
  );
}

/** Derive the base URL from the incoming request for absolute asset paths. */
function getBaseUrl(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
