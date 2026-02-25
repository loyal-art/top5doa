"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function Header() {
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();

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

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-4 h-14">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Top5<span className="text-neutral-500">DOA</span>
        </Link>

        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-neutral-400 hidden sm:inline">
                {user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="text-sm text-neutral-400 hover:text-white transition-colors"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm px-4 py-2 rounded-lg bg-white text-neutral-900 font-medium
                         hover:bg-neutral-200 transition-colors"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
