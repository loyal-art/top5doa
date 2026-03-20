"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  topic_id: string | null;
  topic_slug: string | null;
  read: boolean;
  created_at: string;
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function fetchUsername(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("username, is_admin, avatar_url, daily_streak")
      .eq("id", userId)
      .single();
    setUsername(data?.username ?? null);
    setAvatarUrl(data?.avatar_url ?? null);
    setIsAdmin(data?.is_admin === true);
    setDailyStreak(data?.daily_streak ?? 0);
  }

  async function fetchNotifications(userId: string) {
    const { data: rows } = await supabase
      .from("notifications")
      .select("id, type, title, message, topic_id, read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    const notifRows = rows ?? [];
    const topicIds = notifRows.filter((n) => n.topic_id).map((n) => n.topic_id!);

    let slugMap: Record<string, string> = {};
    if (topicIds.length > 0) {
      const { data: topicRows } = await supabase
        .from("topics")
        .select("id, slug")
        .in("id", topicIds);
      slugMap = Object.fromEntries((topicRows ?? []).map((t) => [t.id, t.slug]));
    }

    setNotifications(
      notifRows.map((n) => ({
        ...n,
        topic_slug: n.topic_id ? (slugMap[n.topic_id] ?? null) : null,
      }))
    );
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        fetchUsername(user.id);
        fetchNotifications(user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchUsername(currentUser.id);
        fetchNotifications(currentUser.id);
      } else {
        setUsername(null);
        setIsAdmin(false);
        setDailyStreak(0);
        setNotifications([]);
      }
    });

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

  // Close dropdowns on outside click
  useEffect(() => {
    if (!notifOpen && !menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (notifOpen && notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifOpen, menuOpen]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/";
  }

  async function markRead(notifId: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", notifId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
    );
  }

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  /* ── Notification bell (shared between mobile & desktop) ──────── */
  const notifBell = (
    <div className="relative" ref={notifRef}>
      <button
        onClick={() => setNotifOpen((o) => !o)}
        aria-label="Notifications"
        className="relative flex items-center justify-center w-8 h-8 rounded-lg
                   text-neutral-500 hover:text-brand-accent transition-colors"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118
               9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64
               3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3
               3 0 11-5.714 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-0.5
                       flex items-center justify-center rounded-full
                       bg-brand-accent text-brand-bg text-[10px] font-mono font-bold"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Notification dropdown ────────────────────────────────── */}
      {notifOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-2xl border
                     border-brand-border bg-brand-surface shadow-2xl overflow-hidden
                     z-50"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
            <span className="font-display text-sm tracking-wide">NOTIFICATIONS</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-mono text-neutral-500 hover:text-brand-accent transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-brand-border">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm font-mono text-neutral-600">
                No notifications yet.
              </p>
            ) : (
              notifications.map((n) => {
                const href = n.topic_slug
                  ? `/topics/${n.topic_slug}`
                  : null;
                const content = (
                  <div
                    className={`px-4 py-3 transition-colors hover:bg-brand-border/20
                               ${!n.read ? "bg-brand-accent/5" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && (
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-accent flex-shrink-0" />
                      )}
                      <div className={`flex-1 min-w-0 ${n.read ? "pl-3.5" : ""}`}>
                        <p className="font-mono text-xs font-bold text-white truncate">
                          {n.title}
                        </p>
                        <p className="text-xs font-mono text-neutral-500 mt-0.5 leading-relaxed">
                          {n.message}
                        </p>
                        <p className="text-[10px] font-mono text-neutral-700 mt-1">
                          {relativeTime(n.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );

                if (href) {
                  return (
                    <Link
                      key={n.id}
                      href={href}
                      onClick={() => {
                        markRead(n.id);
                        setNotifOpen(false);
                      }}
                    >
                      {content}
                    </Link>
                  );
                }
                return (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className="cursor-default"
                  >
                    {content}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-brand-border bg-brand-bg/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-16">
        {/* Logo — min 40px on mobile */}
        <Link href="/" className="flex items-center flex-shrink-0">
          <img
            src="/images/logo-full.png"
            alt="Top5DOA"
            className="h-10 w-auto md:h-16"
          />
        </Link>

        {/* ── Desktop nav (md+) ────────────────────────────────────── */}
        <nav className="hidden md:flex items-center gap-4">
          {user ? (
            <>
              <Link
                href="/feed"
                className="text-sm font-mono text-neutral-500 hover:text-brand-accent transition-colors"
              >
                FEED
              </Link>

              <Link
                href="/leaderboard"
                className="text-sm font-mono brand-glow transition-colors"
                style={{ color: "#FFD700" }}
              >
                LEADERBOARD
              </Link>

              <Link
                href="/hot-takes"
                className="text-sm font-mono flame-glow transition-colors"
                style={{ color: "#FF4500" }}
              >
                HOT TAKES
              </Link>

              <Link
                href="/groups"
                className="text-sm font-mono text-neutral-500 hover:text-brand-accent transition-colors"
              >
                GROUPS
              </Link>

              {notifBell}

              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-sm font-mono text-brand-accent hover:text-brand-accent/80 transition-colors"
                >
                  ADMIN
                </Link>
              )}

              <Link
                href={username ? `/profile/${username}` : "/profile"}
                className="text-sm font-mono transition-colors hover:opacity-80 flex items-center gap-1.5"
                style={{ color: "#e8ff00", textShadow: "0 0 8px rgba(232, 255, 0, 0.6)" }}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-accent shadow-[0_0_6px_rgba(232,255,0,0.6)]" />
                )}
                {username ? `@${username}` : "Profile"}
                {dailyStreak >= 3 && (
                  <span
                    className="text-xs font-mono font-bold flame-glow"
                    style={{ color: "#FF4500" }}
                  >
                    🔥{dailyStreak}
                  </span>
                )}
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

        {/* ── Mobile nav (below md) ────────────────────────────────── */}
        <div className="flex md:hidden items-center gap-2" ref={menuRef}>
          {user ? (
            <>
              {notifBell}

              {/* Hamburger button */}
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Menu"
                className="flex items-center justify-center w-9 h-9 rounded-lg
                           text-neutral-400 hover:text-brand-accent transition-colors"
              >
                {menuOpen ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>

              {/* ── Slide-out panel ──────────────────────────────────── */}
              {menuOpen && (
                <div
                  className="absolute top-full right-0 mt-0 w-64 rounded-bl-2xl border-l border-b
                             border-brand-border bg-brand-bg/95 backdrop-blur-xl shadow-2xl
                             z-50 overflow-hidden"
                >
                  {/* Profile row */}
                  <Link
                    href={username ? `/profile/${username}` : "/profile"}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-5 py-4 border-b border-brand-border
                               hover:bg-white/5 transition-colors"
                  >
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-brand-accent/10 flex items-center justify-center">
                        <span className="inline-block w-2 h-2 rounded-full bg-brand-accent shadow-[0_0_6px_rgba(232,255,0,0.6)]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p
                        className="text-sm font-mono font-bold truncate"
                        style={{ color: "#e8ff00", textShadow: "0 0 8px rgba(232, 255, 0, 0.6)" }}
                      >
                        {username ? `@${username}` : "Profile"}
                        {dailyStreak >= 3 && (
                          <span
                            className="ml-1.5 text-xs flame-glow"
                            style={{ color: "#FF4500" }}
                          >
                            🔥{dailyStreak}
                          </span>
                        )}
                      </p>
                    </div>
                  </Link>

                  {/* Nav links */}
                  <nav className="flex flex-col py-2">
                    <Link
                      href="/feed"
                      onClick={() => setMenuOpen(false)}
                      className="px-5 py-3 text-sm font-mono text-neutral-400 hover:text-brand-accent
                                 hover:bg-white/5 transition-colors"
                    >
                      FEED
                    </Link>
                    <Link
                      href="/leaderboard"
                      onClick={() => setMenuOpen(false)}
                      className="px-5 py-3 text-sm font-mono brand-glow hover:bg-white/5 transition-colors"
                      style={{ color: "#FFD700" }}
                    >
                      LEADERBOARD
                    </Link>
                    <Link
                      href="/hot-takes"
                      onClick={() => setMenuOpen(false)}
                      className="px-5 py-3 text-sm font-mono flame-glow hover:bg-white/5 transition-colors"
                      style={{ color: "#FF4500" }}
                    >
                      HOT TAKES
                    </Link>
                    <Link
                      href="/groups"
                      onClick={() => setMenuOpen(false)}
                      className="px-5 py-3 text-sm font-mono text-neutral-400 hover:text-brand-accent
                                 hover:bg-white/5 transition-colors"
                    >
                      GROUPS
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setMenuOpen(false)}
                        className="px-5 py-3 text-sm font-mono text-brand-accent hover:text-brand-accent/80
                                   hover:bg-white/5 transition-colors"
                      >
                        ADMIN
                      </Link>
                    )}
                  </nav>

                  {/* Sign out */}
                  <div className="border-t border-brand-border py-2">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        handleSignOut();
                      }}
                      className="w-full text-left px-5 py-3 text-sm font-mono text-neutral-500
                                 hover:text-brand-accent hover:bg-white/5 transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm font-mono px-4 py-2 rounded-lg bg-brand-accent text-brand-bg font-bold
                         hover:bg-brand-accent/90 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
