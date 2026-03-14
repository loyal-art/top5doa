import { NextRequest, NextResponse } from "next/server";

type DeezerTrack = {
  link: string;
  preview: string;
  title: string;
  artist: { name: string };
};

async function searchDeezer(
  query: string,
): Promise<DeezerTrack | null> {
  const res = await fetch(
    `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.[0] ?? null;
}

export async function POST(req: NextRequest) {
  const { topicTitle, subjects } = await req.json();

  if (!topicTitle || typeof topicTitle !== "string") {
    return NextResponse.json({ error: "topicTitle is required" }, { status: 400 });
  }

  if (!Array.isArray(subjects) || subjects.length === 0) {
    return NextResponse.json({ error: "subjects array is required" }, { status: 400 });
  }

  const links = await Promise.all(
    subjects.map(async (s: { id: string; name: string }) => {
      const track = await searchDeezer(`${s.name} ${topicTitle}`);
      if (!track) {
        return {
          id: s.id,
          name: s.name,
          deezerUrl: null,
          spotifySearchUrl: null,
          previewUrl: null,
          trackTitle: null,
          artistName: null,
        };
      }
      const spotifyQuery = `${track.artist.name} ${track.title}`;
      return {
        id: s.id,
        name: s.name,
        deezerUrl: track.link,
        spotifySearchUrl: `https://open.spotify.com/search/${encodeURIComponent(spotifyQuery)}`,
        previewUrl: track.preview || null,
        trackTitle: track.title,
        artistName: track.artist.name,
      };
    }),
  );

  return NextResponse.json({ links });
}
