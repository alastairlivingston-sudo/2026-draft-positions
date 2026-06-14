"use client";

import { RankBadge } from "@/components/leaderboard/rank-badge";
import { EventIcon, EVENT_LABELS } from "@/components/shared/event-icon";
import { ManagerAvatar } from "@/components/shared/manager-avatar";
import { PointsPill } from "@/components/shared/points-pill";
import { RankChange } from "@/components/shared/rank-change";
import { computeLeaderboard, getAssetById, getEventFeed, getManagerById } from "@/lib/selectors";
import { useLeagueStore } from "@/lib/store/league-store";

export default function CastPage() {
  const data = useLeagueStore((s) => s);
  const leaderboard = computeLeaderboard(data);
  const feed = getEventFeed(data).slice(0, 8);

  return (
    <div className="flex min-h-screen flex-col gap-6 p-6 sm:p-10">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-xl font-black text-background sm:h-14 sm:w-14 sm:text-2xl">
            WC
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-4xl">World Cup Draft</h1>
            <p className="text-sm text-muted-foreground sm:text-base">Live Leaderboard · Group Stage</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-destructive sm:text-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
          </span>
          LIVE
        </div>
      </header>

      <div className="grid flex-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="flex flex-col gap-2">
          {leaderboard.map((row) => (
            <div
              key={row.manager.id}
              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3 sm:gap-4 sm:p-5"
            >
              <RankBadge rank={row.rank} className="text-base sm:h-12 sm:w-12 sm:text-xl" />
              <ManagerAvatar manager={row.manager} size="lg" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-base font-black sm:text-2xl">{row.manager.name}</span>
                {row.bestAsset && (
                  <span className="truncate text-xs text-muted-foreground sm:text-sm">
                    Best: {row.bestAsset.asset.name} ({row.bestAsset.points >= 0 ? "+" : ""}
                    {row.bestAsset.points})
                  </span>
                )}
              </div>
              <RankChange rankChange={row.rankChange} className="sm:text-base" />
              <div className="flex flex-col items-end">
                <span className="text-xl font-black tabular-nums sm:text-4xl">{row.total}</span>
                <span
                  className={`text-xs font-bold tabular-nums sm:text-sm ${
                    row.change > 0 ? "text-primary" : row.change < 0 ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {row.change > 0 ? `+${row.change}` : row.change} today
                </span>
              </div>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground sm:text-sm">Live Feed</h2>
          {feed.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No fantasy events yet.</p>
          ) : (
            feed.map((entry) => {
              const asset = entry.assetId ? getAssetById(data, entry.assetId) : undefined;
              const manager = getManagerById(data, entry.managerId);
              return (
                <div key={entry.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3">
                  <EventIcon type={entry.type} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-bold sm:text-base">{asset?.name ?? "Unknown asset"}</span>
                    <span className="truncate text-xs text-muted-foreground sm:text-sm">
                      {EVENT_LABELS[entry.type]} · {manager?.name}
                    </span>
                  </div>
                  <PointsPill points={entry.points} />
                </div>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
