import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTierForAura, getGlowColor, getTierBadgeClasses } from "@/lib/aura";

export const metadata = {
  title: "Aura Leaderboard | Top5DOA",
  description: "See who's earning the most Aura on Top5DOA.",
};

type Tab = "daily" | "weekly" | "all-time";

type LeaderboardEntry = {
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  aura_points: number;
  period_aura: number;
};

function rankColor(rank: number): string {
  if (rank === 1) return "#FFD700";
  if (rank === 2) return "#C0C0C0";
  if (rank === 3) return "#CD7F32";
  return "#6b7280";
}

function rankBg(rank: number): string {
  if (rank === 1) return "bg-yellow-500/5 border-yellow-500/20";
  if (rank === 2) return "bg-neutral-400/5 border-neutral-400/20";
  if (rank === 3) return "bg-orange-500/5 border-orange-500/20";
  return "bg-brand-surface border-brand-border";
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const activeTab: Tab =
    params.tab === "daily" || params.tab === "weekly" || params.tab === "all-time"
      ? params.tab
      : "all-time";

  const supabase = await createClient();

  // Current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;

  let entries: LeaderboardEntry[] = [];
  let currentUserEntry: (LeaderboardEntry & { rank: number }) | null = null;

  if (activeTab === "all-time") {
    // All-Time: top 20 by aura_points from profiles
    const { data: rows } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url, aura_points")
      .order("aura_points", { ascending: false })
      .limit(20);

    entries = (rows ?? []).map((r) => ({
      user_id: r.id,
      display_name: r.display_name,
      username: r.username,
      avatar_url: r.avatar_url,
      aura_points: r.aura_points,
      period_aura: r.aura_points,
    }));

    // If current user not in top 20, fetch their rank
    if (currentUserId && !entries.some((e) => e.user_id === currentUserId)) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, aura_points")
        .eq("id", currentUserId)
        .single();

      if (profile) {
        // Count how many users have more aura
        const { count } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .gt("aura_points", profile.aura_points);

        currentUserEntry = {
          user_id: profile.id,
          display_name: profile.display_name,
          username: profile.username,
          avatar_url: profile.avatar_url,
          aura_points: profile.aura_points,
          period_aura: profile.aura_points,
          rank: (count ?? 0) + 1,
        };
      }
    }
  } else {
    // Daily or Weekly: aggregate from aura_log
    const now = new Date();
    let since: string;
    if (activeTab === "daily") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      since = startOfDay.toISOString();
    } else {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      since = sevenDaysAgo.toISOString();
    }

    // Fetch aura_log entries since the cutoff
    const { data: logRows } = await supabase
      .from("aura_log")
      .select("user_id, points")
      .gte("created_at", since);

    // Aggregate by user
    const auraByUser: Record<string, number> = {};
    (logRows ?? []).forEach((r) => {
      auraByUser[r.user_id] = (auraByUser[r.user_id] ?? 0) + r.points;
    });

    // Sort and take top 20
    const sorted = Object.entries(auraByUser)
      .sort(([, a], [, b]) => b - a);
    const top20Ids = sorted.slice(0, 20).map(([id]) => id);

    if (top20Ids.length > 0) {
      // Fetch profiles for top 20
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, aura_points")
        .in("id", top20Ids);

      const profileMap = Object.fromEntries(
        (profiles ?? []).map((p) => [p.id, p])
      );

      entries = sorted
        .slice(0, 20)
        .filter(([id]) => profileMap[id])
        .map(([id, periodAura]) => ({
          user_id: id,
          display_name: profileMap[id].display_name,
          username: profileMap[id].username,
          avatar_url: profileMap[id].avatar_url,
          aura_points: profileMap[id].aura_points,
          period_aura: periodAura,
        }));
    }

    // Current user rank if not in top 20
    if (currentUserId && !entries.some((e) => e.user_id === currentUserId)) {
      const userAura = auraByUser[currentUserId];
      if (userAura && userAura > 0) {
        const rank = sorted.findIndex(([id]) => id === currentUserId) + 1;
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url, aura_points")
          .eq("id", currentUserId)
          .single();

        if (profile && rank > 0) {
          currentUserEntry = {
            user_id: profile.id,
            display_name: profile.display_name,
            username: profile.username,
            avatar_url: profile.avatar_url,
            aura_points: profile.aura_points,
            period_aura: userAura,
            rank,
          };
        }
      }
    }
  }

  const TABS: { label: string; value: Tab }[] = [
    { label: "DAILY", value: "daily" },
    { label: "WEEKLY", value: "weekly" },
    { label: "ALL-TIME", value: "all-time" },
  ];

  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="border-b border-brand-border">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <h1 className="font-display text-4xl sm:text-5xl tracking-wide">
            AURA <span className="brand-glow" style={{ color: "#FFD700" }}>LEADERBOARD</span>
          </h1>
          <p className="text-neutral-500 font-body mt-2">
            Top performers ranked by Aura earned.
          </p>
        </div>
      </section>

      {/* Tabs */}
      <div className="border-b border-brand-border">
        <div className="max-w-3xl mx-auto px-4 flex items-center gap-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <Link
                key={tab.value}
                href={`/leaderboard?tab=${tab.value}`}
                className={`
                  px-5 py-3.5 font-display text-sm tracking-widest
                  border-b-2 -mb-px transition-all duration-200
                  ${isActive
                    ? "text-brand-accent border-brand-accent"
                    : "text-neutral-500 border-transparent hover:text-neutral-200 hover:border-neutral-600"
                  }
                `}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {entries.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-display text-xl text-neutral-600">NO ACTIVITY YET</p>
            <p className="text-sm font-mono text-neutral-700 mt-2">
              {activeTab === "daily"
                ? "No Aura earned today. Be the first!"
                : activeTab === "weekly"
                ? "No Aura earned this week."
                : "No users on the leaderboard yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, idx) => {
              const rank = idx + 1;
              const isCurrentUser = entry.user_id === currentUserId;
              const tierName = getTierForAura(entry.aura_points);
              const glowColor = getGlowColor(tierName);
              const tierBadge = getTierBadgeClasses(tierName);
              const avatarGlowStyle =
                glowColor === "rainbow"
                  ? { boxShadow: "0 0 0 2px #e8ff00, 0 0 8px 2px rgba(232,255,0,0.3)" }
                  : { boxShadow: `0 0 0 2px ${glowColor}, 0 0 8px 2px ${glowColor}30` };

              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-colors
                    ${isCurrentUser
                      ? "bg-brand-accent/5 border-brand-accent/30 ring-1 ring-brand-accent/20"
                      : rankBg(rank)
                    }`}
                >
                  {/* Rank */}
                  <span
                    className="font-display text-2xl w-8 text-right flex-shrink-0"
                    style={{ color: rankColor(rank) }}
                  >
                    {rank}
                  </span>

                  {/* Avatar */}
                  {entry.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.avatar_url}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      style={avatarGlowStyle}
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-brand-accent/10"
                      style={avatarGlowStyle}
                    >
                      <span className="font-display text-sm text-brand-accent">
                        {entry.display_name
                          .split(" ")
                          .map((w) => w[0] ?? "")
                          .slice(0, 2)
                          .join("")
                          .toUpperCase() || "?"}
                      </span>
                    </div>
                  )}

                  {/* Name + username + tier badge */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Link
                        href={`/profile/${entry.username}`}
                        className="font-display text-sm tracking-wide truncate text-white hover:text-brand-accent transition-colors"
                      >
                        {entry.display_name.toUpperCase()}
                      </Link>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono
                                   font-bold border flex-shrink-0 ${tierBadge}`}
                      >
                        {tierName.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-neutral-600 truncate">
                      @{entry.username}
                    </p>
                  </div>

                  {/* Aura count */}
                  <div className="flex-shrink-0 text-right">
                    <p
                      className="font-display text-lg"
                      style={{ color: "#FFD700" }}
                    >
                      {entry.period_aura.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-mono text-neutral-600 uppercase">Aura</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Current user not in top 20 */}
        {currentUserEntry && (
          <div className="mt-6 pt-4 border-t border-brand-border">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-brand-accent/5 border border-brand-accent/30">
              <span
                className="font-display text-lg w-8 text-right flex-shrink-0 text-neutral-500"
              >
                {currentUserEntry.rank}
              </span>

              {currentUserEntry.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentUserEntry.avatar_url}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-brand-accent/10">
                  <span className="font-display text-sm text-brand-accent">
                    {currentUserEntry.display_name
                      .split(" ")
                      .map((w) => w[0] ?? "")
                      .slice(0, 2)
                      .join("")
                      .toUpperCase() || "?"}
                  </span>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-neutral-400">
                  Your rank:{" "}
                  <span className="text-brand-accent font-bold">
                    #{currentUserEntry.rank}
                  </span>
                  {" — "}
                  <span style={{ color: "#FFD700" }}>
                    {currentUserEntry.period_aura.toLocaleString()} Aura
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
