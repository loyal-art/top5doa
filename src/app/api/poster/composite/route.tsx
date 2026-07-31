import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { fetchImageBytes, parseImageSource } from "@/lib/safe-image-url";
import satori from "satori";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

// ── Font cache ───────────────────────────────────────────────────────────────
// Fonts are fetched once then held in module-scope memory for the process lifetime.

let bebasNeueFont: ArrayBuffer | null = null;
let dmSansFont: ArrayBuffer | null = null;

async function loadFonts() {
  // Using NotoSans (bundled with next/og) as a guaranteed-valid TTF fallback
  // for both slots until BebasNeue + DMSans can be sourced correctly.
  const fontPath = path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf");

  if (!bebasNeueFont) {
    const buf = await fs.readFile(fontPath);
    bebasNeueFont = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    console.log(
      "BebasNeue slot loaded, bytes:", bebasNeueFont.byteLength,
      "header:", Buffer.from(bebasNeueFont).slice(0, 4).toString("hex")
    );
  }
  if (!dmSansFont) {
    const buf = await fs.readFile(fontPath);
    dmSansFont = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    console.log(
      "DM Sans slot loaded, bytes:", dmSansFont.byteLength,
      "header:", Buffer.from(dmSansFont).slice(0, 4).toString("hex")
    );
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
  valuesTagline?: string;
}

// ── Route handler ────────────────────────────────────────────────────────────

/** satori + sharp are CPU-heavy, and this route fetches a remote image. */
const COMPOSITE_LIMIT = 20;
const COMPOSITE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const limit = rateLimit(`composite:${auth.userId}`, COMPOSITE_LIMIT, COMPOSITE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

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
    valuesTagline,
  } = body;

  if (!aiImageUrl || !topicTitle || !top5?.length) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // SSRF guard: never hand a caller-supplied string to fetch(). Only a data:
  // image URL or an allowlisted image host is accepted.
  const imageSource = parseImageSource(aiImageUrl);
  if (!imageSource) {
    return new Response(
      JSON.stringify({ error: "aiImageUrl is not an accepted image source" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Load fonts in parallel with the AI image.
  const [fonts, aiImageBase64] = await Promise.all([
    loadFonts(),
    imageSource.kind === "data"
      ? Promise.resolve(imageSource.value)
      : fetchImageBytes(imageSource.url).then(
          (buf) =>
            `data:image/png;base64,${Buffer.from(buf).toString("base64")}`,
        ),
  ]);

  const safeColor = tierColor === "rainbow" ? "#ffffff" : tierColor || "#6b7280";
  const RANK_COLORS = ["#FFD700", "#C0C0C0", "#10B981", "#14B8A6", "#3B82F6"];
  const initial = (displayName || username || "?").charAt(0).toUpperCase();

  // Canvas: 1080×1080
  // Zone breakdown (pixels):
  //   TOP        0 –  86px  (0–8%)
  //   HERO      86 – 540px  (8–50%)  — unobstructed
  //   RANKINGS 540 – 799px  (50–74%)
  //   ARCHETYPE799 – 885px  (74–82%)
  //   LOGO     885 –1015px  (82–94%)  ← most prominent
  //   BOTTOM  1015 –1080px  (94–100%)
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
          position: "relative",
          fontFamily: "DM Sans",
          overflow: "hidden",
          background: "#000",
        }}
      >
        {/* ── AI art background ── */}
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

        {/* ── Gradient overlay — bottom 55% (transparent at 45% → opaque at 100%) ── */}
        <div
          style={{
            position: "absolute",
            top: "486px",   // 45% of 1080
            bottom: 0,
            left: 0,
            right: 0,
            display: "flex",
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.55) 25%, rgba(0,0,0,0.8) 55%, rgba(0,0,0,0.9) 100%)",
          }}
        />

        {/* ══════════════════════════════════════════════════
            TOP ZONE  0–86px  — Topic title
        ══════════════════════════════════════════════════ */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "86px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          {/* Dark scrim behind title for readability over bright AI art */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.3) 70%, transparent 100%)",
            }}
          />
          <div
            style={{
              fontSize: "26px",
              fontWeight: 900,
              color: "#FFD700",
              textTransform: "uppercase" as const,
              letterSpacing: "2px",
              lineHeight: 1,
              display: "flex",
              textAlign: "center",
              textShadow: "0 2px 16px rgba(0,0,0,0.95), 0 0 40px rgba(0,0,0,0.8)",
            }}
          >
            {topicTitle.toUpperCase()}
          </div>
          <div
            style={{
              fontSize: "14px",
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "5px",
              textTransform: "uppercase" as const,
              lineHeight: 1,
              display: "flex",
              textAlign: "center",
              textShadow: "0 1px 8px rgba(0,0,0,0.9)",
            }}
          >
            MY TOP 5
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            HERO ZONE  86–540px  — unobstructed AI art
        ══════════════════════════════════════════════════ */}

        {/* ══════════════════════════════════════════════════
            RANKINGS  540–799px  — Top 5 rows
        ══════════════════════════════════════════════════ */}
        <div
          style={{
            position: "absolute",
            top: "540px",
            left: "40px",
            right: "40px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {top5.slice(0, 5).map((item, idx) => {
            const rankColor = RANK_COLORS[idx] ?? "#3B82F6";
            const nameLen = item.name.length;
            const fontSize = nameLen > 45 ? 22 : nameLen > 30 ? 28 : 36;
            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: "52px",
                  background: "rgba(0,0,0,0.7)",
                  borderRadius: "8px",
                  overflow: "hidden",
                  border:
                    idx === 0
                      ? "1px solid rgba(255,215,0,0.35)"
                      : "1px solid rgba(255,255,255,0.08)",
                  gap: "0px",
                }}
              >
                {/* Rank square — flush left, full height */}
                <div
                  style={{
                    width: "52px",
                    height: "52px",
                    background: rankColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: "30px",
                      fontWeight: 900,
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
                    letterSpacing: "0.3px",
                    lineHeight: 1.1,
                    display: "flex",
                    flex: 1,
                    paddingLeft: "16px",
                    paddingRight: "12px",
                    textShadow: "0 2px 10px rgba(0,0,0,0.8)",
                    overflow: "hidden",
                  }}
                >
                  {item.name}
                </div>
              </div>
            );
          })}
        </div>

        {/* ══════════════════════════════════════════════════
            ARCHETYPE  840–930px  — Identity plate (pushed down for ranking clearance)
        ══════════════════════════════════════════════════ */}
        {archetype && (
          <div
            style={{
              position: "absolute",
              top: "840px",
              left: 0,
              right: 0,
              height: "86px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                background: "rgba(0,0,0,0.72)",
                border: "1px solid rgba(255,215,0,0.35)",
                borderRadius: "50px",
                padding: "14px 32px",
              }}
            >
              <div
                style={{
                  fontSize: "30px",
                  lineHeight: 1,
                  display: "flex",
                }}
              >
                {archetype.icon}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 700,
                    color: "#FFD700",
                    letterSpacing: "1.5px",
                    textTransform: "uppercase" as const,
                    lineHeight: 1,
                    display: "flex",
                  }}
                >
                  {archetype.name.toUpperCase()}
                </div>
                {valuesTagline ? (
                  <div
                    style={{
                      fontSize: "16px",
                      fontStyle: "italic",
                      color: "#d4af37",
                      lineHeight: 1.3,
                      display: "flex",
                    }}
                  >
                    {valuesTagline}
                  </div>
                ) : archetype.secondary ? (
                  <div
                    style={{
                      fontSize: "16px",
                      color: "#a78bfa",
                      lineHeight: 1,
                      display: "flex",
                    }}
                  >
                    {`with a touch of ${archetype.secondary}`}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            LOGO  940–1015px  — Brand stamp (highest priority)
        ══════════════════════════════════════════════════ */}
        <div
          style={{
            position: "absolute",
            top: "940px",
            left: 0,
            right: 0,
            height: "130px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: "16px",
            paddingBottom: "16px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${getBaseUrl(req)}/images/logo-full.png`}
            style={{
              height: "200px",
              maxWidth: "80%",
              objectFit: "contain",
            }}
          />
        </div>

        {/* ══════════════════════════════════════════════════
            BOTTOM  1015–1080px  — User info bar
        ══════════════════════════════════════════════════ */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "65px",
            padding: "0 30px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {/* User info — left */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #2a2a2a, #1a1a1a)",
                border: `2px solid ${safeColor}`,
                boxShadow: `0 0 10px ${safeColor}66`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#FFD700",
                  lineHeight: 1,
                  display: "flex",
                }}
              >
                {initial}
              </div>
            </div>

            {/* Name + @username + tier + aura */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "3px",
              }}
            >
              {displayName && (
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#ffffff",
                    lineHeight: 1,
                    display: "flex",
                    textShadow: "0 1px 6px rgba(0,0,0,0.9)",
                  }}
                >
                  {displayName}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {username && (
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#999999",
                      lineHeight: 1,
                      display: "flex",
                    }}
                  >
                    @{username}
                  </div>
                )}
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#ffffff",
                    background: `${safeColor}4d`,
                    border: `1px solid ${safeColor}99`,
                    borderRadius: "4px",
                    padding: "2px 7px",
                    textTransform: "uppercase" as const,
                    letterSpacing: "1px",
                    lineHeight: 1,
                    display: "flex",
                  }}
                >
                  {tier}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: safeColor,
                    letterSpacing: "1px",
                    lineHeight: 1,
                    display: "flex",
                    textShadow: `0 0 12px ${safeColor}80`,
                  }}
                >
                  {aura.toLocaleString()} AURA
                </div>
              </div>
            </div>
          </div>

          {/* WWW.TOP5DOA.APP — right */}
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "#e8ff00",
              letterSpacing: "2px",
              lineHeight: 1,
              display: "flex",
              textShadow: "0 0 24px rgba(232,255,0,0.5), 0 2px 8px rgba(0,0,0,0.9)",
            }}
          >
            WWW.TOP5DOA.APP
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
