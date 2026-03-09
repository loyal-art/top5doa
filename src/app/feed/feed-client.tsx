"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { FeedItem } from "./page";

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const RANK_COLORS = ["#e8ff00", "#a78bfa", "#6b7280"];

function FeedCard({ item }: { item: FeedItem }) {
  const initials = item.displayName
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-surface hover:border-brand-accent/20 transition-colors">
      {/* Header: avatar + user + timestamp */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <Link
          href={`/profile/${item.username}`}
          className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-brand-accent/10 border border-brand-accent/30 hover:border-brand-accent transition-colors"
        >
          <span className="font-display text-sm text-brand-accent">{initials}</span>
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            href={`/profile/${item.username}`}
            className="font-display text-sm tracking-wide text-white hover:text-brand-accent transition-colors"
          >
            {item.displayName.toUpperCase()}
          </Link>
          <p className="text-xs font-mono text-neutral-600">
            locked in a list · {relativeTime(item.votedAt)}
          </p>
        </div>
      </div>

      {/* Topic link */}
      <Link
        href={`/topics/${item.topicSlug}`}
        className="block mx-5 mb-3 px-4 py-3 rounded-xl bg-brand-bg border border-brand-border hover:border-brand-accent/30 transition-colors group"
      >
        <p className="font-mono text-[10px] text-neutral-600 uppercase tracking-widest mb-1">
          Topic
        </p>
        <p className="font-display text-lg tracking-wide text-white group-hover:text-brand-accent transition-colors leading-tight">
          {item.topicTitle.toUpperCase()}
        </p>
      </Link>

      {/* Top 3 ranked subjects */}
      {item.top3.length > 0 && (
        <div className="px-5 pb-5">
          <p className="font-display text-[10px] tracking-[0.2em] text-neutral-600 mb-2">
            TOP {item.top3.length}
          </p>
          <ol className="flex flex-col gap-1.5">
            {item.top3.map((entry, i) => (
              <li key={i} className="flex items-center gap-3">
                <span
                  className="font-display text-lg leading-none w-5 text-right flex-shrink-0"
                  style={{ color: RANK_COLORS[i] ?? "#6b7280" }}
                >
                  {entry.rank}
                </span>
                <span className="text-sm font-body text-neutral-300 truncate">
                  {entry.name}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export function FeedClient({
  items: initialItems,
  hasMore: initialHasMore,
  followedIds,
  userId,
}: {
  items: FeedItem[];
  hasMore: boolean;
  followedIds: string[];
  userId: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(initialItems.length);

  async function loadMore() {
    if (loading || !hasMore || followedIds.length === 0) return;
    setLoading(true);

    const supabase = createClient();
    const PAGE_SIZE = 10;

    // Fetch next batch of rows
    const { data: listRows } = await supabase
      .from("user_lists")
      .select("id, user_id, topic_id, subject_id, rank_position, updated_at")
      .in("user_id", followedIds)
      .order("updated_at", { ascending: false })
      .range(offset, offset + 200);

    const allRows = listRows ?? [];

    // Group by user_id + topic_id
    const existingKeys = new Set(items.map((i) => `${i.userId}::${i.topicId}`));
    const listMap = new Map<string, typeof allRows>();
    for (const row of allRows) {
      const key = `${row.user_id}::${row.topic_id}`;
      if (existingKeys.has(key)) continue;
      if (!listMap.has(key)) listMap.set(key, []);
      listMap.get(key)!.push(row);
    }

    const grouped = [...listMap.entries()]
      .map(([key, rows]) => {
        const [uId, tId] = key.split("::");
        const mostRecent = rows.reduce((a, b) =>
          new Date(a.updated_at) > new Date(b.updated_at) ? a : b
        );
        return {
          userId: uId!,
          topicId: tId!,
          updatedAt: mostRecent.updated_at,
          rows: rows.sort((a, b) => a.rank_position - b.rank_position),
        };
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const page = grouped.slice(0, PAGE_SIZE);

    if (page.length === 0) {
      setHasMore(false);
      setLoading(false);
      return;
    }

    // Fetch profiles, topics, subjects for new items
    const userIds = [...new Set(page.map((l) => l.userId))];
    const topicIds = [...new Set(page.map((l) => l.topicId))];
    const subjectIds = [...new Set(page.flatMap((l) => l.rows.map((r) => r.subject_id)))];

    const [profilesRes, topicsRes, subjectsRes] = await Promise.all([
      supabase.from("profiles").select("id, username, display_name").in("id", userIds),
      supabase.from("topics").select("id, title, slug").in("id", topicIds),
      supabase.from("subjects").select("id, name").in("id", subjectIds),
    ]);

    const profileMap = Object.fromEntries(
      (profilesRes.data ?? []).map((p) => [p.id, { username: p.username, displayName: p.display_name }])
    );
    const topicMap = Object.fromEntries(
      (topicsRes.data ?? []).map((t) => [t.id, { title: t.title, slug: t.slug }])
    );
    const subjectMap = Object.fromEntries(
      (subjectsRes.data ?? []).map((s) => [s.id, s.name])
    );

    const newItems: FeedItem[] = page.map((l) => ({
      listId: `${l.userId}-${l.topicId}`,
      userId: l.userId,
      displayName: profileMap[l.userId]?.displayName ?? "Unknown",
      username: profileMap[l.userId]?.username ?? "",
      topicId: l.topicId,
      topicTitle: topicMap[l.topicId]?.title ?? "Unknown Topic",
      topicSlug: topicMap[l.topicId]?.slug ?? "",
      votedAt: l.updatedAt,
      top3: l.rows.slice(0, 3).map((r) => ({
        rank: r.rank_position,
        name: subjectMap[r.subject_id] ?? "—",
      })),
    }));

    setItems((prev) => [...prev, ...newItems]);
    setOffset((o) => o + 200);
    setHasMore(grouped.length > PAGE_SIZE);
    setLoading(false);
  }

  // Empty state — user follows nobody
  if (followedIds.length === 0) {
    return (
      <main className="min-h-screen">
        <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
          <svg className="w-12 h-12 text-neutral-700 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
          <h1 className="font-display text-3xl tracking-wide">NO LISTS YET</h1>
          <p className="text-neutral-500 font-body">
            Follow people to see their lists here.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-brand-accent text-black font-display text-sm tracking-widest hover:bg-brand-accent/90 transition-colors mt-4"
          >
            EXPLORE DEBATES
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl tracking-wide">FEED</h1>
          <p className="text-neutral-500 font-body text-sm mt-1">
            Latest lists from people you follow.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-brand-border bg-brand-surface">
            <p className="font-display text-2xl text-neutral-600">NO LISTS YET</p>
            <p className="text-sm text-neutral-600 mt-2 font-body">
              The people you follow haven&apos;t locked in any lists yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <FeedCard key={item.listId} item={item} />
            ))}
          </div>
        )}

        {hasMore && (
          <div className="text-center pt-2">
            <button
              onClick={loadMore}
              disabled={loading}
              className="px-8 py-3 rounded-xl bg-brand-surface border border-brand-border text-sm font-mono text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors disabled:opacity-50"
            >
              {loading ? "Loading..." : "Load More"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
