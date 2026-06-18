"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";

import { EventFeedItem } from "@/components/events/event-feed-item";
import { CountryFlag } from "@/components/shared/country-flag";
import { ManagerAvatar } from "@/components/shared/manager-avatar";
import { PointsPill } from "@/components/shared/points-pill";
import { RankChange } from "@/components/shared/rank-change";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLeagueStore } from "@/lib/store/league-store";
import {
  computeLeaderboard,
  getAssetPoints,
  getEventFeed,
  getManagerAssets,
  isAssetStillToPlay,
} from "@/lib/selectors";
import { PositionChip } from "@/components/shared/position-chip";
import { SquadRow } from "@/components/squad/squad-row";

export default function ManagerSquadPage() {
  const params = useParams<{ id: string }>();
  const data = useLeagueStore((s) => s);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const manager = data.managers.find((m) => m.id === params.id);

  if (!manager) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-lg font-bold">Manager not found</p>
        <Link href="/league/world-cup-draft" className="text-sm font-semibold text-primary hover:underline">
          Back to leaderboard
        </Link>
      </div>
    );
  }

  const leaderboard = computeLeaderboard(data);
  const row = leaderboard.find((r) => r.manager.id === manager.id)!;
  const assets = getManagerAssets(data, manager.id);
  const feed = getEventFeed(data);

  const selectedAsset = selectedAssetId ? assets.find((a) => a.id === selectedAssetId) ?? null : null;
  const selectedFeed = selectedAssetId ? feed.filter((entry) => entry.assetId === selectedAssetId) : [];
  const managerAdjustments = feed.filter((entry) => entry.managerId === manager.id && entry.assetId === null);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/league/world-cup-draft"
        className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Leaderboard
      </Link>

      <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-4">
        <ManagerAvatar manager={manager} size="xl" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-xl font-black sm:text-2xl">{manager.name}</h1>
          <p className="truncate text-sm text-muted-foreground">{manager.tagline}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-bold text-foreground">Rank #{row.rank}</span> of {leaderboard.length}
            <RankChange rankChange={row.rankChange} />
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="text-3xl font-black tabular-nums sm:text-4xl">{row.total}</span>
          <span
            className={`text-xs font-bold tabular-nums ${
              row.change > 0 ? "text-primary" : row.change < 0 ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {row.change > 0 ? `+${row.change}` : row.change} today
          </span>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Squad ({assets.length} of 8)
        </h2>
        <div className="grid gap-2">
          {assets.map((asset) => {
            const points = getAssetPoints(data, asset.id);
            const eventCount = feed.filter((entry) => entry.assetId === asset.id).length;
            return (
              <SquadRow
                key={asset.id}
                asset={asset}
                points={points}
                eventCount={eventCount}
                stillToPlay={isAssetStillToPlay(data, asset)}
                onClick={() => setSelectedAssetId(asset.id)}
              />
            );
          })}
        </div>
      </section>

      {managerAdjustments.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Adjustments</h2>
          <div className="grid gap-2">
            {managerAdjustments.map((entry) => (
              <EventFeedItem key={entry.id} entry={entry} manager={manager} linkToManager={false} />
            ))}
          </div>
        </section>
      ) : null}

      <Sheet open={!!selectedAssetId} onOpenChange={(open) => !open && setSelectedAssetId(null)}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-3xl">
          {selectedAsset && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="flex items-center gap-2 text-lg">
                  <CountryFlag countryCode={selectedAsset.countryCode} className="text-2xl" />
                  {selectedAsset.name}
                  <PositionChip position={selectedAsset.position} />
                </SheetTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {selectedAsset.country} · Total{" "}
                  <PointsPill points={getAssetPoints(data, selectedAsset.id)} size="sm" />
                </div>
              </SheetHeader>
              <div className="flex flex-col gap-2 px-4 pb-6">
                {selectedFeed.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No fantasy events recorded yet for this asset.
                  </p>
                ) : (
                  selectedFeed.map((entry) => {
                    const match = entry.matchId ? data.matches.find((m) => m.id === entry.matchId) : undefined;
                    return (
                      <EventFeedItem
                        key={entry.id}
                        entry={entry}
                        asset={selectedAsset}
                        linkToManager={false}
                        matchLabel={match ? `${match.homeTeam} vs ${match.awayTeam}` : undefined}
                      />
                    );
                  })
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
