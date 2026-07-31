/**
 * Best-effort in-memory rate limiter for the routes that cost real money
 * per call (OpenAI image generation, FLUX, Claude).
 *
 * LIMITATION, read before trusting this: state lives in the module scope of
 * a single server instance. It resets on deploy and is not shared between
 * serverless instances, so a horizontally-scaled deployment can admit up to
 * (limit x instance count). It is a spend circuit-breaker against a single
 * user hammering an endpoint, NOT a security boundary. The auth guard in
 * `api-auth.ts` is the security boundary. If spend needs a hard ceiling,
 * move this to a Postgres table or Upstash Redis.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Drop expired buckets so the Map cannot grow without bound. */
function sweep(now: number) {
  if (buckets.size < 5_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * @param key    Caller identity — use the authenticated user id, never an IP.
 * @param limit  Max requests allowed inside the window.
 * @param windowMs Window length in milliseconds.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    retryAfterSeconds: 0,
  };
}
