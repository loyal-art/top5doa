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

/** Detect Deezer URLs and return embeddable widget URL. */
export function getDeezerEmbed(url: string): { src: string; height: number } | null {
  try {
    const u = new URL(url);
    // Already a widget embed URL
    if (u.hostname === "widget.deezer.com") {
      return { src: url, height: 80 };
    }
    // Regular Deezer track URL — convert to widget embed
    if (u.hostname === "www.deezer.com" || u.hostname === "deezer.com") {
      const match = u.pathname.match(/\/track\/(\d+)/);
      if (!match) return null;
      return {
        src: `https://widget.deezer.com/widget/dark/track/${match[1]}`,
        height: 80,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Try to resolve a media URL into an embed-friendly src + height.
 *  Returns null if the URL doesn't match any known embed provider. */
export function resolveEmbed(url: string): { src: string; height: number } | null {
  return getSpotifyEmbed(url) ?? getAppleMusicEmbed(url) ?? getDeezerEmbed(url) ?? null;
}
