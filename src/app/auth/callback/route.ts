import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const cookiesToSet: {
      name: string;
      value: string;
      options: Record<string, unknown>;
    }[] = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return [...new Headers(request.headers).entries()]
              .filter(([key]) => key === "cookie")
              .flatMap(([, value]) =>
                value.split(";").map((c) => {
                  const [name, ...rest] = c.trim().split("=");
                  return { name, value: rest.join("=") };
                }),
              );
          },
          setAll(cookies) {
            cookiesToSet.push(
              ...cookies.map(({ name, value, options }) => ({
                name,
                value,
                options: options as Record<string, unknown>,
              })),
            );
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Ensure profile has an avatar_url — pull from Google metadata or generate via DiceBear
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("avatar_url, username")
            .eq("id", user.id)
            .single();

          if (profile && !profile.avatar_url) {
            const googleAvatar = user.user_metadata?.avatar_url
              ?? user.user_metadata?.picture
              ?? null;
            const avatarUrl = googleAvatar
              ?? `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(profile.username ?? user.id)}`;
            await supabase
              .from("profiles")
              .update({ avatar_url: avatarUrl })
              .eq("id", user.id);
          }
        }
      } catch {
        // Non-blocking — don't fail the auth flow for avatar issues
      }

      const response = NextResponse.redirect(`${origin}${next}`);
      for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, options);
      }
      return response;
    }
  }

  // Auth code exchange failed — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
