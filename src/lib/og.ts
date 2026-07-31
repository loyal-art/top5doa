import fs from "fs/promises";
import path from "path";

/**
 * Shared pieces for the `opengraph-image.tsx` routes.
 *
 * 1200x630 is the size Facebook, X, LinkedIn and Slack all crop from. Do not
 * change it without re-testing in each debugger — several of them cache
 * aggressively and will keep serving the old aspect ratio for days.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;

export const OG_CONTENT_TYPE = "image/png";

/** Mirrors the `brand` palette in tailwind.config.ts. Keep in sync. */
export const OG_COLORS = {
  bg: "#0a0a0a",
  surface: "#141414",
  border: "#2a2a2a",
  accent: "#e8ff00",
  aura: "#a78bfa",
  muted: "#8a8a8a",
} as const;

let cachedFont: ArrayBuffer | null = null;

/**
 * NotoSans is the only font bundled in `public/fonts`. The brand display face
 * (Bebas Neue) is loaded from Google Fonts in the browser and is not available
 * on the server, so OG cards render in NotoSans until it is vendored in.
 */
export async function loadOgFont(): Promise<ArrayBuffer> {
  if (cachedFont) return cachedFont;

  const fontPath = path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf");
  const buf = await fs.readFile(fontPath);
  cachedFont = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  ) as ArrayBuffer;

  return cachedFont;
}

/** Font descriptor in the shape `ImageResponse` expects. */
export async function ogFonts() {
  return [
    {
      name: "NotoSans",
      data: await loadOgFont(),
      style: "normal" as const,
      weight: 400 as const,
    },
  ];
}

/** Truncate for card layouts that must not wrap past two lines. */
export function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}
