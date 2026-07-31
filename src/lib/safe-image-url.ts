/**
 * SSRF guard for the poster compositing route.
 *
 * `/api/poster/composite` used to pass a caller-supplied `aiImageUrl` straight
 * into `fetch()`. Because that fetch runs on the server, a caller could point
 * it at anything the server can reach — cloud metadata endpoints
 * (169.254.169.254), internal admin panels, localhost services — and use the
 * response size or error timing as an oracle. This module constrains the URL
 * to the image hosts the app actually produces.
 *
 * Two legitimate shapes reach this route:
 *   1. `data:image/...;base64,...`  — produced client-side, never fetched.
 *   2. An https URL from OpenAI (Azure blob) or fal.ai, or Supabase storage.
 */

/** Host suffixes the poster pipeline can legitimately return. */
const ALLOWED_HOST_SUFFIXES = [
  ".blob.core.windows.net", // OpenAI gpt-image results
  "fal.media",
  ".fal.media",
  "fal.ai",
  ".fal.ai",
];

const ALLOWED_DATA_PREFIXES = [
  "data:image/png;base64,",
  "data:image/jpeg;base64,",
  "data:image/webp;base64,",
];

/** Cap on the remote image we are willing to pull into memory. */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** Timeout for the remote image fetch. */
export const IMAGE_FETCH_TIMEOUT_MS = 15_000;

function supabaseStorageHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase();

  if (host === supabaseStorageHost()) return true;

  return ALLOWED_HOST_SUFFIXES.some((suffix) =>
    suffix.startsWith(".") ? host.endsWith(suffix) : host === suffix,
  );
}

export type ImageSource =
  | { kind: "data"; value: string }
  | { kind: "remote"; url: string };

/**
 * Returns a safe image source, or null if the input is not something we are
 * willing to load. Callers MUST treat null as a 400 and must not fall back to
 * fetching the raw input.
 */
export function parseImageSource(raw: unknown): ImageSource | null {
  if (typeof raw !== "string" || raw.length === 0) return null;

  if (raw.startsWith("data:")) {
    return ALLOWED_DATA_PREFIXES.some((p) => raw.startsWith(p))
      ? { kind: "data", value: raw }
      : null;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  // https only — http would allow plaintext interception and is never produced
  // by our own pipeline.
  if (parsed.protocol !== "https:") return null;

  // Embedded credentials are a classic filter-bypass trick
  // (https://allowed.host@internal.target/).
  if (parsed.username || parsed.password) return null;

  // Non-default ports point at internal services far more often than at CDNs.
  if (parsed.port && parsed.port !== "443") return null;

  if (!hostAllowed(parsed.hostname)) return null;

  return { kind: "remote", url: parsed.toString() };
}

/**
 * Fetch an allowlisted remote image with a timeout and a size cap.
 * Throws on timeout, non-2xx, non-image content type, or oversize body.
 */
export async function fetchImageBytes(url: string): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "error", // a redirect could land somewhere off the allowlist
    });

    if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      throw new Error(`Unexpected content-type: ${contentType}`);
    }

    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > MAX_IMAGE_BYTES) throw new Error("Image too large");

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_IMAGE_BYTES) throw new Error("Image too large");

    return buf;
  } finally {
    clearTimeout(timer);
  }
}
