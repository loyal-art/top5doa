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
  const [isAdmin, setIsAdmin] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function fetchUsername(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("username, is_admin")
      .eq("id", userId)
      .single();
    setUsername(data?.username ?? null);
    setIsAdmin(data?.is_admin === true);
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

  // Close dropdown on outside click
  useEffect(() => {
    if (!notifOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifOpen]);

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
              {/* Feed link */}
              <Link
                href="/feed"
                className="text-sm font-mono text-neutral-500 hover:text-brand-accent transition-colors"
              >
                FEED
              </Link>

              {/* ── Notification bell ──────────────────────────────────── */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen((o) => !o)}
                  aria-label="Notifications"
                  className="relative flex items-center justify-center w-8 h-8 rounded-lg
                             text-neutral-500 hover:text-brand-accent transition-colors"
                >
                  {/* Bell icon */}
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
                  {/* Unread badge */}
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

                {/* ── Dropdown ─────────────────────────────────────────── */}
                {notifOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-80 rounded-2xl border
                               border-brand-border bg-brand-surface shadow-2xl overflow-hidden
                               z-50"
                  >
                    {/* Header row */}
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

                    {/* List */}
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

              {/* Admin link */}
              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-sm font-mono text-brand-accent hover:text-brand-accent/80 transition-colors"
                >
                  ADMIN
                </Link>
              )}

              {/* Profile link */}
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
