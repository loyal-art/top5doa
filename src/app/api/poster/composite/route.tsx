import { NextRequest } from "next/server";
import satori from "satori";
import sharp from "sharp";

export const runtime = "nodejs";

// ── Font cache ───────────────────────────────────────────────────────────────
// Fonts are fetched once then held in module-scope memory for the process lifetime.

let bebasNeueFont: ArrayBuffer | null = null;
let dmSansFont: ArrayBuffer | null = null;

async function loadFonts() {
  if (!bebasNeueFont) {
    const bebasRes = await fetch(
      "https://fonts.gstatic.com/s/bebasneue/v14/JTUSjIg69CK48gW7PXoQ.ttf"
    );
    bebasNeueFont = await bebasRes.arrayBuffer();
  }
  if (!dmSansFont) {
    const dmRes = await fetch(
      "https://fonts.gstatic.com/s/dmsans/v15/rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmg.ttf"
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
  console.log('Satori composite called');
  try {
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
  console.log('Fetching fonts...');
  console.log('Fetching AI image...');
  const [fonts, aiImageRes] = await Promise.all([
    loadFonts(),
    fetch(aiImageUrl).then((r) => r.arrayBuffer()),
  ]);

  console.log('AI image size:', aiImageRes.byteLength);
  console.log('Font sizes — BebasNeue:', fonts.bebasNeue.byteLength, 'DM Sans:', fonts.dmSans.byteLength);

  const aiImageBase64 = `data:image/png;base64,${Buffer.from(aiImageRes).toString("base64")}`;

  // Tier glow color parsing for badge
  const safeColor = tierColor === "rainbow" ? "#ffffff" : tierColor || "#6b7280";

  const RANK_COLORS = ["#FFD700", "#C0C0C0", "#10B981", "#14B8A6", "#3B82F6"];

  const initial = (displayName || username || "?").charAt(0).toUpperCase();

  const W = 1080;
  const H = 1080;

  console.log(`Rendering with Satori at ${W}x${H}...`);
  let svgString: string;
  try {
  svgString = await satori(
    (
      <div
        style={{
          width: `${W}px`,
          height: `${H}px`,
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
          width={W}
          height={H}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: `${W}px`,
            height: `${H}px`,
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
            height: "325px",
            display: "flex",
            background:
              "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.5) 70%, transparent 100%)",
          }}
        />

        {/* ── TOP ZONE: Topic title ── */}
        <div
          style={{
            position: "absolute",
            top: "18px",
            left: "24px",
            right: "24px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontFamily: "Bebas Neue",
              fontSize: "14px",
              color: "#FFD700",
              letterSpacing: "1.5px",
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
              fontSize: "7px",
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "2px",
              textTransform: "uppercase" as const,
              marginTop: "3px",
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
            left: "24px",
            right: "24px",
            top: "210px",
            display: "flex",
            flexDirection: "column",
            gap: "5px",
          }}
        >
          {top5.slice(0, 5).map((item, idx) => {
            const rankColor = RANK_COLORS[idx] ?? "#3B82F6";
            const isFirst = idx === 0;
            const nameLen = item.name.length;
            const fontSize = nameLen > 45 ? 10 : nameLen > 30 ? 12 : 18;
            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "rgba(0,0,0,0.6)",
                  borderRadius: "6px",
                  padding: isFirst ? "7px 10px" : "5px 10px",
                  border: isFirst
                    ? "1px solid rgba(255,215,0,0.3)"
                    : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {/* Rank square */}
                <div
                  style={{
                    width: isFirst ? "28px" : "24px",
                    height: isFirst ? "28px" : "24px",
                    borderRadius: "5px",
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
                      fontSize: isFirst ? "18px" : "15px",
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
                    paddingLeft: "10px",
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
                marginTop: "3px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  background: "rgba(0,0,0,0.6)",
                  border: "1px solid rgba(255,215,0,0.25)",
                  borderRadius: "5px",
                  padding: "4px 9px",
                }}
              >
                <div style={{ fontSize: "11px", display: "flex" }}>
                  {archetype.icon}
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      fontFamily: "Bebas Neue",
                      fontSize: "9px",
                      color: "#FFD700",
                      letterSpacing: "1px",
                      lineHeight: 1.2,
                      display: "flex",
                    }}
                  >
                    {archetype.name.toUpperCase()}
                  </div>
                  {archetype.secondary && (
                    <div
                      style={{
                        fontSize: "6px",
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
            bottom: "45px",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${getBaseUrl(req)}/images/logo-full.png`}
            height={100}
            style={{ height: "100px", objectFit: "contain" }}
          />
        </div>

        {/* ── BOTTOM ZONE: User info (left) + branding (right) ── */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "0 24px 18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          {/* User info */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Avatar circle */}
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #2a2a2a, #1a1a1a)",
                border: `2px solid ${safeColor}`,
                boxShadow: `0 0 8px ${safeColor}66`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  fontFamily: "Bebas Neue",
                  fontSize: "12px",
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
                gap: "1px",
              }}
            >
              {displayName && (
                <div
                  style={{
                    fontSize: "10px",
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
                    fontSize: "7px",
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
                  gap: "5px",
                  marginTop: "1px",
                }}
              >
                <div
                  style={{
                    fontSize: "6px",
                    fontWeight: 800,
                    color: "#ffffff",
                    background: `${safeColor}59`,
                    border: `1px solid ${safeColor}b3`,
                    borderRadius: "3px",
                    padding: "2px 5px",
                    textTransform: "uppercase" as const,
                    letterSpacing: "1px",
                    display: "flex",
                  }}
                >
                  {tier}
                </div>
                <div
                  style={{
                    fontFamily: "Bebas Neue",
                    fontSize: "8px",
                    color: safeColor,
                    letterSpacing: "1px",
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
              fontSize: "14px",
              color: "#e8ff00",
              fontWeight: 700,
              letterSpacing: "1.5px",
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
      width: W,
      height: H,
      fonts: [
        { name: "Bebas Neue", data: fonts.bebasNeue, style: "normal", weight: 400 },
        { name: "DM Sans", data: fonts.dmSans, style: "normal", weight: 400 },
      ],
    }
  );
  } catch (renderError: unknown) {
    const err = renderError instanceof Error ? renderError : new Error(String(renderError));
    console.error('Satori render error:', err.message, err.stack);
    return new Response(JSON.stringify({ error: 'Satori render failed: ' + err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log('Converting SVG to PNG with sharp...');
  let pngBuffer: Buffer;
  try {
    pngBuffer = await sharp(Buffer.from(svgString)).png().toBuffer();
  } catch (sharpError: unknown) {
    const err = sharpError instanceof Error ? sharpError : new Error(String(sharpError));
    console.error('Sharp error:', err.message, err.stack);
    return new Response(JSON.stringify({ error: 'PNG conversion failed: ' + err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log('Returning PNG, size:', pngBuffer.byteLength);
  return new Response(new Uint8Array(pngBuffer), {
    headers: { "Content-Type": "image/png" },
  });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Composite error:', err.message, err.stack);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/** Derive the base URL from the incoming request for absolute asset paths. */
function getBaseUrl(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
