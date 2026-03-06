/** Extract the video ID from a YouTube URL (regular or short link). */
export function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch {
    /* not a valid URL */
  }
  return null;
}

/** Build a YouTube embed URL for silent background looping. */
export function youtubeBackgroundSrc(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&controls=0&showinfo=0&playlist=${videoId}`;
}

/** Build a YouTube embed URL for PiP playback (with audio). */
export function youtubePipSrc(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}`;
}
