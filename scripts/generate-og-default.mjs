/**
 * Generate the static 1200x630 Open Graph fallback image from the app logo.
 *
 *   node scripts/generate-og-default.mjs
 *
 * Writes public/images/og-default.png. Committed to the repo — social crawlers
 * fetch it directly, so it must be a real file, not generated at request time.
 *
 * This is a placeholder composed from existing brand assets; a designed
 * replacement can simply overwrite public/images/og-default.png at the same
 * dimensions without any code change.
 */

import sharp from "sharp";
import path from "node:path";

const W = 1200;
const H = 630; // the 1.91:1 ratio Facebook, X, LinkedIn and Slack all expect

const BRAND_BG = "#0a0a0a";
const BRAND_ACCENT = "#e8ff00";

const LOGO = path.join(process.cwd(), "public/images/logo-full.png");
const OUT = path.join(process.cwd(), "public/images/og-default.png");

// Leave generous margin — crawlers and chat clients crop the edges differently.
const LOGO_TARGET = 380;

const logo = await sharp(LOGO)
  .resize(LOGO_TARGET, LOGO_TARGET, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .toBuffer();

// Subtle accent glow behind the mark plus the wordmark, drawn as SVG so no
// font files are required at build time.
const overlay = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="42%" r="46%">
      <stop offset="0%"   stop-color="${BRAND_ACCENT}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${BRAND_ACCENT}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <text x="${W / 2}" y="${H - 96}" text-anchor="middle"
        font-family="Arial Black, Arial, Helvetica, sans-serif"
        font-size="54" font-weight="900" letter-spacing="6"
        fill="#ffffff">TOP5DOA</text>
  <text x="${W / 2}" y="${H - 52}" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="24" letter-spacing="3"
        fill="#9a9a9a">DEBATE THE GREATEST OF ALL TIME</text>
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${BRAND_ACCENT}"/>
</svg>
`);

await sharp({
  create: {
    width: W,
    height: H,
    channels: 4,
    background: BRAND_BG,
  },
})
  .composite([
    { input: overlay, top: 0, left: 0 },
    {
      input: logo,
      top: Math.round(H / 2 - LOGO_TARGET / 2) - 60,
      left: Math.round(W / 2 - LOGO_TARGET / 2),
    },
  ])
  .png()
  .toFile(OUT);

const meta = await sharp(OUT).metadata();
console.log(`Wrote ${OUT} — ${meta.width}x${meta.height}, ${meta.channels}ch`);
