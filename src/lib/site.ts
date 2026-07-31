/**
 * Canonical site URL, used as the `metadataBase` for every Open Graph and
 * Twitter tag in the app.
 *
 * This MUST be an absolute URL. Facebook, X, WhatsApp, iMessage and Slack all
 * refuse to render a preview card whose image is a relative path — which is
 * why `metadataBase` existing at all is the thing that unblocks link previews.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL  — set this in production to the real domain.
 *   2. NEXT_PUBLIC_VERCEL_URL — auto-populated on Vercel preview deploys.
 *   3. localhost:3000        — local dev fallback.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();

export const siteMetadataBase = new URL(SITE_URL);

export const SITE_NAME = "Top5DOA";

export const SITE_TAGLINE =
  "Debate the greatest of all time across any category";

/** Build an absolute URL for a path on this site. */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}
