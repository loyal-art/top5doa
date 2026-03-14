/** Detect and convert Spotify URLs to embed URLs. */
export function getSpotifyEmbed(url: string): { src: string; height: number } | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "open.spotify.com") return null;
    // pathname like /track/ABC123, /album/ABC123, /playlist/ABC123
    const match = u.pathname.match(/^\/(track|album|playlist)\/([A-Za-z0-9]+)/);
    if (!match) return null;
    const [, type, id] = match;
    return {
      src: `https://open.spotify.com/embed/${type}/${id}`,
      height: type === "track" ? 80 : 380,
    };
  } catch {
    return null;
  }
}

/** Detect and convert Apple Music URLs to embed URLs. */
export function getAppleMusicEmbed(url: string): { src: string; height: number } | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "music.apple.com") return null;
    // Replace host with embed host, keep the rest of the path
    return {
      src: `https://embed.music.apple.com${u.pathname}`,
      height: 150,
    };
  } catch {
    return null;
  }
}

/** Detect Deezer widget URLs (already embeddable). */
export function getDeezerEmbed(url: string): { src: string; height: number } | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "widget.deezer.com") return null;
    // Already an embed URL like widget.deezer.com/widget/dark/track/123
    return { src: url, height: 80 };
  } catch {
    return null;
  }
}

/** Try to resolve a media URL into an embed-friendly src + height.
 *  Returns null if the URL doesn't match any known embed provider. */
export function resolveEmbed(url: string): { src: string; height: number } | null {
  return getSpotifyEmbed(url) ?? getAppleMusicEmbed(url) ?? getDeezerEmbed(url) ?? null;
}
