"use client";

import { format } from "date-fns";
import Link from "next/link";
import { CalendarClock, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

import { CountryFlag } from "@/components/shared/country-flag";
import { ManagerAvatar } from "@/components/shared/manager-avatar";
import { useLeagueStore } from "@/lib/store/league-store";
import { computeLeaderboard, getTodaysMovers, getTopAssetOverall, getUpcomingMatches } from "@/lib/selectors";

export function SummaryWidgets() {
  const data = useLeagueStore((s) => s);
  const movers = getTodaysMovers(data, 1);
  const topAsset = getTopAssetOverall(data);
  const upcoming = getUpcomingMatches(data);
  const leaderboard = computeLeaderboard(data);
  const liveCount = leaderboard.reduce((sum, row) => sum + row.remainingAssets, 0);

  const topMover = movers[0];
  const nextMatch = upcoming[0];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Today&apos;s Mover
        </div>
        {topMover ? (
          <Link
            href={`/league/world-cup-draft/manager/${topMover.manager.id}`}
            className="flex items-center gap-2.5"
          >
            <ManagerAvatar manager={topMover.manager} size="md" />
            <div className="flex flex-col">
              <span className="font-bold leading-tight">{topMover.manager.name}</span>
              <span
                className={`flex items-center gap-1 text-sm font-extrabold leading-tight ${
                  topMover.change > 0 ? "text-primary" : "text-destructive"
                }`}
              >
                {topMover.change > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {topMover.change > 0 ? `+${topMover.change}` : topMover.change} pts
              </span>
            </div>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">No live movement yet</p>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          Top Asset
        </div>
        {topAsset ? (
          <Link
            href={`/league/world-cup-draft/manager/${topAsset.manager.id}`}
            className="flex items-center gap-2.5"
          >
            <CountryFlag countryCode={topAsset.asset.countryCode} className="text-2xl" />
            <div className="flex flex-col">
              <span className="truncate font-bold leading-tight">{topAsset.asset.name}</span>
              <span className="text-sm font-extrabold leading-tight text-primary">+{topAsset.points} pts</span>
            </div>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">No points yet</p>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5 text-sky-300" />
          Still to Play
        </div>
        <div className="flex flex-col">
          <span className="font-bold leading-tight">{liveCount} squad assets</span>
          {nextMatch ? (
            <span className="text-sm leading-tight text-muted-foreground">
              Next: {nextMatch.homeTeam} vs {nextMatch.awayTeam} ·{" "}
              {nextMatch.status === "live" ? "Live now" : format(new Date(nextMatch.kickoff), "EEE HH:mm")}
            </span>
          ) : (
            <span className="text-sm leading-tight text-muted-foreground">All matches complete</span>
          )}
        </div>
      </div>
    </div>
  );
}
