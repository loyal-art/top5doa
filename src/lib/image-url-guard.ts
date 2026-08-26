import dns from "node:dns/promises";

/**
 * Hard ceiling on the AI image the compositor will pull into memory.
 * Satori + sharp hold the decoded bitmap, so an unbounded fetch is a
 * memory-exhaustion vector as well as a bandwidth one.
 */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Hosts that /api/ai/generate-poster can legitimately hand back as `imageUrl`.
 * Derived from that route, not guessed:
 *   - tryFlux() returns fal.ai FLUX output URLs (fal.media / v2 / v3).
 *   - tryOpenAI() returns `data.data[0].url` when the images API responds with
 *     a URL rather than b64_json; OpenAI serves those from its Azure blob host.
 * No Supabase storage host is listed because this project does not use
 * Supabase storage anywhere (`supabase.storage` appears nowhere in src/).
 */
const ALLOWED_IMAGE_HOSTS = new Set([
  "fal.media",
  "v2.fal.media",
  "v3.fal.media",
  "oaidalleapiprodscus.blob.core.windows.net",
]);

/**
 * In practice the primary path is not an http URL at all: OpenAI's
 * gpt-image-1.5 returns b64_json, and the client turns that into a
 * `data:image/...;base64,` URL before posting it here. Those are accepted
 * inline — they involve no outbound request, so they carry no SSRF risk.
 */
const DATA_URL_PREFIX = /^data:(image\/[a-z0-9.+-]+);base64,/i;

export type ImageLoadResult =
  | { ok: true; bytes: Buffer }
  | { ok: false; status: number; error: string };

function fail(status: number, error: string): ImageLoadResult {
  return { ok: false, status, error };
}

/** IPv4 ranges that must never be reachable from a user-supplied URL. */
function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true; // unparseable — refuse rather than guess
  }
  const [a, b] = parts;

  if (a === 0) return true;                          // 0.0.0.0/8 "this network"
  if (a === 10) return true;                         // private
  if (a === 127) return true;                        // loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a === 169 && b === 254) return true;           // 169.254/16 link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16/12 private
  if (a === 192 && b === 168) return true;           // 192.168/16 private
  if (a === 192 && b === 0) return true;             // 192.0.0/24 + 192.0.2/24 special-purpose
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18/15 benchmarking
  if (a === 198 && b === 51) return true;            // 198.51.100/24 TEST-NET-2
  if (a === 203 && b === 0) return true;             // 203.0.113/24 TEST-NET-3
  if (a >= 224) return true;                         // multicast, reserved, broadcast

  return false;
}

/** IPv6 equivalents, including IPv4-mapped forms like ::ffff:169.254.169.254. */
function isBlockedIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().split("%")[0]; // drop any zone id

  const mapped = addr.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIPv4(mapped[1]);

  // ::, ::1 and everything else in ::/8 is special-purpose.
  if (addr.startsWith("::")) return true;

  const firstGroup = parseInt(addr.split(":")[0], 16);
  if (Number.isNaN(firstGroup)) return true;
  if ((firstGroup & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((firstGroup & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((firstGroup & 0xff00) === 0xff00) return true; // ff00::/8 multicast

  return false;
}

function isBlockedAddress(address: string, family: number): boolean {
  return family === 6 ? isBlockedIPv6(address) : isBlockedIPv4(address);
}

/**
 * Resolve the hostname and refuse if ANY answer lands in a private, loopback,
 * or link-local range — an allowlisted name that resolves inward is still an
 * SSRF, so the name check alone is not enough.
 */
async function resolvesToPublicAddress(hostname: string): Promise<boolean> {
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses.length) return false;
    return !addresses.some((a) => isBlockedAddress(a.address, a.family));
  } catch {
    return false; // fail closed on resolution failure
  }
}

/** Read a response body, aborting as soon as it exceeds the byte cap. */
async function readCapped(res: Response): Promise<ImageLoadResult> {
  const declared = res.headers.get("content-length");
  if (declared && Number(declared) > MAX_IMAGE_BYTES) {
    return fail(413, "Image exceeds the maximum allowed size");
  }

  const reader = res.body?.getReader();
  if (!reader) return fail(502, "Failed to retrieve the source image");

  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      return fail(413, "Image exceeds the maximum allowed size");
    }
    chunks.push(value);
  }

  return { ok: true, bytes: Buffer.concat(chunks) };
}

/**
 * Validate a caller-supplied image URL and load its bytes.
 *
 * Accepts only:
 *   - `data:image/*;base64,` payloads (decoded inline, no network access)
 *   - https URLs on ALLOWED_IMAGE_HOSTS whose DNS answers are all public
 *
 * Everything else is refused with 400. Redirects are refused outright so an
 * allowlisted host cannot bounce the request to an internal address.
 */
export async function loadAllowedImage(rawUrl: string): Promise<ImageLoadResult> {
  if (typeof rawUrl !== "string" || !rawUrl) {
    return fail(400, "Invalid image URL");
  }

  // ── data: URLs — the primary path for the OpenAI provider ──
  const dataMatch = rawUrl.match(DATA_URL_PREFIX);
  if (dataMatch) {
    const base64 = rawUrl.slice(dataMatch[0].length);
    // 4 base64 chars per 3 bytes — check before allocating.
    if ((base64.length * 3) / 4 > MAX_IMAGE_BYTES) {
      return fail(413, "Image exceeds the maximum allowed size");
    }
    const bytes = Buffer.from(base64, "base64");
    if (!bytes.byteLength) return fail(400, "Invalid image URL");
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return fail(413, "Image exceeds the maximum allowed size");
    }
    return { ok: true, bytes };
  }

  if (rawUrl.startsWith("data:")) {
    // A data: URL that is not base64 image data.
    return fail(400, "Image URL is not from an allowed source");
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return fail(400, "Invalid image URL");
  }

  if (url.protocol !== "https:") {
    return fail(400, "Image URL is not from an allowed source");
  }
  if (url.username || url.password) {
    return fail(400, "Image URL is not from an allowed source");
  }
  if (url.port && url.port !== "443") {
    return fail(400, "Image URL is not from an allowed source");
  }
  if (!ALLOWED_IMAGE_HOSTS.has(url.hostname.toLowerCase())) {
    return fail(400, "Image URL is not from an allowed source");
  }
  if (!(await resolvesToPublicAddress(url.hostname))) {
    return fail(400, "Image URL is not from an allowed source");
  }

  let res: Response;
  try {
    res = await fetch(url, { redirect: "error" });
  } catch (err) {
    console.error("[image-url-guard] fetch failed:", err instanceof Error ? err.message : err);
    return fail(502, "Failed to retrieve the source image");
  }

  if (!res.ok) {
    console.error(`[image-url-guard] source image responded ${res.status}`);
    return fail(502, "Failed to retrieve the source image");
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    return fail(400, "Image URL is not from an allowed source");
  }

  return readCapped(res);
}
