"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const supabase = createClient();

  async function fetchUsername(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single();
    setUsername(data?.username ?? null);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) fetchUsername(user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchUsername(currentUser.id);
      } else {
        setUsername(null);
      }
    });

    // Keep the header link in sync when the user renames their username
    // on the profile page (profile-client dispatches this custom event).
    function handleUsernameUpdate(e: Event) {
      const newUsername = (e as CustomEvent<{ username: string }>).detail.username;
      setUsername(newUsername);
    }
    window.addEventListener("profile-username-updated", handleUsernameUpdate);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("profile-username-updated", handleUsernameUpdate);
    };
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-50 border-b border-brand-border bg-brand-bg/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-16">
        <Link href="/" className="flex items-center gap-1.5 group">
          <span className="font-display text-2xl tracking-wide text-white group-hover:text-brand-accent transition-colors">
            TOP5
          </span>
          <span className="font-display text-2xl tracking-wide text-brand-accent">
            DOA
          </span>
        </Link>

        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Link
                href={username ? `/profile/${username}` : "/profile"}
                className="text-sm font-mono text-neutral-500 hover:text-brand-accent transition-colors"
              >
                {username ? `@${username}` : "Profile"}
              </Link>
              <button
                onClick={handleSignOut}
                className="text-sm font-mono text-neutral-500 hover:text-brand-accent transition-colors"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm font-mono px-5 py-2 rounded-lg bg-brand-accent text-brand-bg font-bold
                         hover:bg-brand-accent/90 transition-colors"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
