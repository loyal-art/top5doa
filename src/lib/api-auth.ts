import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth guards for API route handlers.
 *
 * Mirrors the `getAdminUser()` pattern in `src/app/admin/actions.ts`, but
 * returns a ready-to-send NextResponse on failure so route handlers can
 * bail out in two lines:
 *
 *   const auth = await requireAdmin();
 *   if (!auth.ok) return auth.response;
 *
 * Note: these rely on Supabase auth cookies, which is what the browser
 * already sends. `getUser()` re-validates the JWT against Supabase rather
 * than trusting the cookie contents, so it is safe to authorise on.
 */

export type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

function deny(message: string, status: number): AuthResult {
  return { ok: false, response: NextResponse.json({ error: message }, { status }) };
}

/** Requires any signed-in user. */
export async function requireUser(): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return deny("Not authenticated", 401);
  return { ok: true, userId: user.id };
}

/** Requires a signed-in user whose profile has `is_admin = true`. */
export async function requireAdmin(): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return deny("Not authenticated", 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) return deny("Not authorized", 403);
  return { ok: true, userId: user.id };
}
