import type { SupabaseClient } from "@supabase/supabase-js";

/** Storage bucket holding generated posters. Public — see the bucket migration. */
export const POSTER_BUCKET = "posters";

/**
 * Object key for a user's poster on a topic. Deterministic, so regenerating
 * overwrites in place and there is exactly one object per (user, topic) — the
 * same semantics the delete-then-insert on poster_images already had.
 */
export function posterObjectPath(userId: string, topicId: string): string {
  return `${userId}/${topicId}.png`;
}

/**
 * True when a stored image_data value is a URL rather than legacy base64.
 * Rows written before the storage migration hold a bare base64 PNG with no
 * `data:` prefix; rows written after hold a public URL.
 */
export function isPosterUrl(imageData: string): boolean {
  return /^https?:\/\//i.test(imageData);
}

/**
 * Resolve a poster_images.image_data value to something an <img src> or a
 * download link can use. Handles both shapes during (and after) the transition.
 */
export function resolvePosterSrc(imageData: string): string {
  return isPosterUrl(imageData)
    ? imageData
    : `data:image/png;base64,${imageData}`;
}

/** Decode bare base64 (no data: prefix) into a PNG Blob, browser-side. */
function base64ToPngBlob(base64: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: "image/png" });
}

/**
 * Upload a poster PNG to storage and return its public URL.
 *
 * The returned URL carries a `?v=` cache-buster: the object key is
 * deterministic, so without one a regenerated poster would keep serving the
 * previous image from the CDN for the life of the cache header.
 *
 * Returns null on failure — callers fall back to storing base64 so a storage
 * outage degrades to the old behaviour rather than losing the poster.
 */
export async function uploadPoster(
  supabase: SupabaseClient,
  userId: string,
  topicId: string,
  base64: string,
): Promise<string | null> {
  try {
    const path = posterObjectPath(userId, topicId);

    const { error } = await supabase.storage
      .from(POSTER_BUCKET)
      .upload(path, base64ToPngBlob(base64), {
        contentType: "image/png",
        cacheControl: "31536000",
        upsert: true,
      });

    if (error) {
      console.error("[poster-storage] upload failed:", error.message);
      return null;
    }

    const { data } = supabase.storage.from(POSTER_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) return null;

    return `${data.publicUrl}?v=${Date.now()}`;
  } catch (err) {
    console.error(
      "[poster-storage] upload threw:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** Click a synthetic anchor to save `href` as `filename`. */
function triggerDownload(href: string, filename: string): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = href;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Save a poster to disk, given either shape of image_data.
 *
 * The `download` attribute is ignored for cross-origin URLs — the browser
 * navigates to the image instead of saving it — so a storage URL cannot be
 * handed straight to an anchor. Fetching it into a blob first works because
 * blob: URLs count as same-origin. Supabase serves these objects with
 * `Access-Control-Allow-Origin: *`, so the fetch is not blocked.
 *
 * Legacy base64 (data:) values are exempt from the cross-origin rule and are
 * downloaded directly.
 */
export async function downloadPoster(
  src: string,
  filename: string,
): Promise<void> {
  if (!isPosterUrl(src)) {
    triggerDownload(src, filename);
    return;
  }

  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`status ${res.status}`);

    const objectUrl = URL.createObjectURL(await res.blob());
    triggerDownload(objectUrl, filename);
    // Revoking immediately can cancel an in-flight save in some browsers.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  } catch (err) {
    console.error(
      "[poster-storage] download failed:",
      err instanceof Error ? err.message : err,
    );
    // Last resort — open the image so the user can save it manually.
    window.open(src, "_blank", "noopener");
  }
}
