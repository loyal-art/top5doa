import { NextRequest, NextResponse } from "next/server";

async function getSpotifyToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function searchSpotifyTrack(
  token: string,
  subjectName: string,
  topicTitle: string,
): Promise<string | null> {
  const q = `track:${subjectName} ${topicTitle}`;
  const params = new URLSearchParams({
    q,
    type: "track",
    limit: "1",
  });

  const res = await fetch(
    `https://api.spotify.com/v1/search?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!res.ok) return null;

  const data = await res.json();
  const track = data.tracks?.items?.[0];
  return track?.external_urls?.spotify ?? null;
}

export async function POST(req: NextRequest) {
  const { topicTitle, subjects } = await req.json();

  if (!topicTitle || typeof topicTitle !== "string") {
    return NextResponse.json({ error: "topicTitle is required" }, { status: 400 });
  }

  if (!Array.isArray(subjects) || subjects.length === 0) {
    return NextResponse.json({ error: "subjects array is required" }, { status: 400 });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are not configured" },
      { status: 500 },
    );
  }

  let token: string;
  try {
    token = await getSpotifyToken(clientId, clientSecret);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to authenticate with Spotify" },
      { status: 502 },
    );
  }

  const links = await Promise.all(
    subjects.map(async (s: { id: string; name: string }) => {
      const spotifyUrl = await searchSpotifyTrack(token, s.name, topicTitle);
      return { id: s.id, name: s.name, spotifyUrl };
    }),
  );

  return NextResponse.json({ links });
}
