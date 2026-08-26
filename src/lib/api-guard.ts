import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** A window to enforce. `key` defaults to the route key it is registered under. */
type Window = { key?: string; limit: number; windowSeconds: number };

/**
 * Per-route limits, keyed by the logical route name stored in api_rate_limits.
 * Windows are checked in array order — put the coarsest (daily) first so a
 * caller who has already exhausted the day does not also burn an hourly slot.
 */
export const RATE_LIMITS: Record<string, Window[]> = {
  "ai/generate-topic": [{ limit: 10, windowSeconds: 3600 }],
  "ai/generate-archetypes": [{ limit: 10, windowSeconds: 3600 }],
  "ai/find-music-links": [{ limit: 10, windowSeconds: 3600 }],
  "ai/generate-values-tagline": [{ limit: 15, windowSeconds: 3600 }],
  "ai/generate-poster": [
    { key: "ai/generate-poster:daily", limit: 15, windowSeconds: 86400 },
    { limit: 5, windowSeconds: 3600 },
  ],
  "poster/composite": [{ limit: 20, windowSeconds: 3600 }],
};

export type GuardResult =
  | { ok: true; supabase: ServerClient; userId: string }
  | { ok: false; response: NextResponse };

function deny(status: number, error: string, headers?: HeadersInit): GuardResult {
  return { ok: false, response: NextResponse.json({ error }, { status, headers }) };
}

/**
 * Resolve the caller's session. Fails closed: any error resolving the user is
 * treated as unauthenticated. Never surfaces the underlying error to the client.
 */
async function resolveUser(
  route: string,
): Promise<{ supabase: ServerClient; userId: string } | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return null;
    return { supabase, userId: data.user.id };
  } catch (err) {
    console.error(`[api-guard] auth resolution failed for ${route}:`, err);
    return null;
  }
}

/**
 * Increment and check every window registered for `route`.
 * Fails closed — if the limiter itself errors the request is refused (503),
 * because letting it through is what puts spend on a real credit card.
 */
async function enforceRateLimit(
  supabase: ServerClient,
  userId: string,
  route: string,
): Promise<GuardResult | null> {
  for (const window of RATE_LIMITS[route] ?? []) {
    const key = window.key ?? route;
    try {
      const { data, error } = await supabase.rpc("check_api_rate_limit", {
        p_identifier: userId,
        p_route: key,
        p_limit: window.limit,
        p_window_seconds: window.windowSeconds,
      });

      if (error || !data) {
        console.error(`[api-guard] rate limit check failed for ${key}:`, error);
        return deny(503, "Service temporarily unavailable. Please try again later.");
      }

      if (!data.allowed) {
        return deny(429, "Rate limit exceeded. Please try again later.", {
          "Retry-After": String(data.retry_after_seconds),
        });
      }
    } catch (err) {
      console.error(`[api-guard] rate limit check threw for ${key}:`, err);
      return deny(503, "Service temporarily unavailable. Please try again later.");
    }
  }
  return null;
}

/** Require a signed-in caller, then apply the route's rate limits. */
export async function requireUser(route: string): Promise<GuardResult> {
  const session = await resolveUser(route);
  if (!session) return deny(401, "Authentication required");

  const limited = await enforceRateLimit(session.supabase, session.userId, route);
  if (limited) return limited;

  return { ok: true, supabase: session.supabase, userId: session.userId };
}

/** Require a signed-in admin, then apply the route's rate limits. */
export async function requireAdmin(route: string): Promise<GuardResult> {
  const session = await resolveUser(route);
  if (!session) return deny(401, "Authentication required");

  let isAdmin = false;
  try {
    const { data, error } = await session.supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", session.userId)
      .single();
    // Fail closed: an errored lookup is not an admin.
    if (error) {
      console.error(`[api-guard] admin lookup failed for ${route}:`, error);
    } else {
      isAdmin = data?.is_admin === true;
    }
  } catch (err) {
    console.error(`[api-guard] admin lookup threw for ${route}:`, err);
  }

  if (!isAdmin) return deny(403, "Admin access required");

  const limited = await enforceRateLimit(session.supabase, session.userId, route);
  if (limited) return limited;

  return { ok: true, supabase: session.supabase, userId: session.userId };
}
