/**
 * Sanitize a post-auth return path. Only same-origin absolute paths pass;
 * anything else (external URLs, protocol-relative, empty) falls back to "/".
 * Mirrors the check in /auth/callback so both paths agree.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

/** Build a login/signup href that returns to `next` afterwards. */
export function authHref(page: "login" | "signup", next: string): string {
  return `/${page}?next=${encodeURIComponent(next)}`;
}
