import { NextRequest, NextResponse } from "next/server";

type DeezerTrack = {
  id: number;
  link: string;
  preview: string;
  title: string;
  artist: { name: string };
};

async function extractArtist(
  apiKey: string,
  topicTitle: string,
): Promise<string | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 128,
      system:
        "Extract the primary artist, band, or musician name from the given topic title. Return ONLY the artist name as plain text with no quotes, no explanation, no punctuation. If no artist can be identified, return the word NONE.",
      messages: [
        { role: "user", content: topicTitle },
      ],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = (data.content?.[0]?.text ?? "").trim();
  if (!text || text === "NONE") return null;
  return text;
}

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 },
    );
  }

  // Use Claude to extract the artist name from the topic title
  const artist = await extractArtist(apiKey, topicTitle);

  const links = await Promise.all(
    subjects.map(async (s: { id: string; name: string }) => {
      const query = artist ? `${s.name} ${artist}` : s.name;
      const track = await searchDeezer(query);
      if (!track) {
        return {
          id: s.id,
          name: s.name,
          deezerUrl: null,
          deezerEmbedUrl: null,
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
        deezerEmbedUrl: `https://widget.deezer.com/widget/dark/track/${track.id}`,
        spotifySearchUrl: `https://open.spotify.com/search/${encodeURIComponent(spotifyQuery)}`,
        previewUrl: track.preview || null,
        trackTitle: track.title,
        artistName: track.artist.name,
      };
    }),
  );

  return NextResponse.json({ links });
}
