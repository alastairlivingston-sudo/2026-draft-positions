"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { LeaderboardCard } from "@/components/leaderboard/leaderboard-card";
import { SummaryWidgets } from "@/components/leaderboard/summary-widgets";
import { EventFeedItem } from "@/components/events/event-feed-item";
import { EVENT_LABELS } from "@/components/shared/event-icon";
import { ShareBar } from "@/components/shared/share-bar";
import { useLeagueStore } from "@/lib/store/league-store";
import { computeLeaderboard, getAssetById, getEventFeed, getManagerById } from "@/lib/selectors";

export default function LeaderboardPage() {
  const data = useLeagueStore((s) => s);
  const leaderboard = computeLeaderboard(data);
  const feed = getEventFeed(data).slice(0, 3);

  const latest = feed[0];
  const latestAsset = latest?.assetId ? getAssetById(data, latest.assetId) : undefined;
  const latestManager = latest ? getManagerById(data, latest.managerId) : undefined;
  const latestAnnouncement = latest
    ? `${latestAsset?.name ?? "Update"}: ${EVENT_LABELS[latest.type]} for ${latestManager?.name ?? "a manager"}, ${
        latest.points >= 0 ? "+" : ""
      }${latest.points} points`
    : "";

  return (
    <div className="flex flex-col gap-5">
      <div aria-live="polite" className="sr-only">
        {latestAnnouncement}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">League Leaderboard</h1>
          <p className="text-sm text-muted-foreground">World Cup Draft · 8 managers · Group Stage</p>
        </div>
        <ShareBar />
      </div>

      <SummaryWidgets />

      <section className="flex flex-col gap-2">
        {leaderboard.map((row) => (
          <LeaderboardCard key={row.manager.id} row={row} />
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Live Event Feed</h2>
          <Link
            href="/league/world-cup-draft/events"
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          {feed.map((entry) => (
            <EventFeedItem
              key={entry.id}
              entry={entry}
              manager={getManagerById(data, entry.managerId)}
              asset={entry.assetId ? getAssetById(data, entry.assetId) : undefined}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
