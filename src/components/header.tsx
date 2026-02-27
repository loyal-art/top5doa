"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  // Stable client reference — createClient() returns a new object every call,
  // so keeping it in a ref prevents it from being a changing useEffect dep.
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Fetch the username whenever the logged-in user changes.
  useEffect(() => {
    if (!user) { setUsername(null); return; }
    supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single()
      .then(({ data }) => setUsername(data?.username ?? null));
  }, [user, supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    setUsername(null);
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
              {username && (
                <Link
                  href={`/profile/${username}`}
                  className="text-sm font-mono text-neutral-400 hover:text-brand-accent transition-colors"
                >
                  @{username}
                </Link>
              )}
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
