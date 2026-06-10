/**
 * Global app configuration flags.
 */

/**
 * When true, every user account is treated as premium regardless of their
 * actual `is_premium` / `premium_expires_at` values. Flip to `false` once
 * billing is live and real subscription checks should resume.
 */
export const GLOBAL_PREMIUM_ENABLED = true;
