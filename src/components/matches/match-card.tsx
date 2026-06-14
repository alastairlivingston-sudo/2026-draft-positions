import Link from "next/link";
import { format } from "date-fns";
import { Lock, LockOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/shared/country-flag";
import { MatchStatusBadge } from "@/components/shared/match-status-badge";
import { PointsPill } from "@/components/shared/points-pill";
import { PositionChip } from "@/components/shared/position-chip";
import type { Manager, Match, SquadAsset } from "@/lib/types";

export interface MatchAssetRow {
  asset: SquadAsset;
  manager: Manager;
  points: number;
}

interface MatchCardProps {
  match: Match;
  assets: MatchAssetRow[];
  isAdmin: boolean;
  onToggleLock?: () => void;
}

export function MatchCard({ match, assets, isAdmin, onToggleLock }: MatchCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{match.stage}</span>
        <MatchStatusBadge status={match.status} minute={match.minute} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-2">
          <CountryFlag countryCode={match.homeCountryCode} className="text-2xl" />
          <span className="truncate text-sm font-bold sm:text-base">{match.homeTeam}</span>
        </div>
        {match.status === "upcoming" ? (
          <span className="text-xs font-bold uppercase text-muted-foreground">vs</span>
        ) : (
          <div className="flex items-center gap-1.5 text-lg font-black tabular-nums sm:text-xl">
            <span>{match.homeScore}</span>
            <span className="text-muted-foreground">-</span>
            <span>{match.awayScore}</span>
          </div>
        )}
        <div className="flex flex-1 items-center justify-end gap-2 text-right">
          <span className="truncate text-sm font-bold sm:text-base">{match.awayTeam}</span>
          <CountryFlag countryCode={match.awayCountryCode} className="text-2xl" />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{format(new Date(match.kickoff), "EEE d MMM · HH:mm")}</span>
        <span className="truncate">{match.venue}</span>
      </div>

      {assets.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border/60 pt-3">
          <span className="pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Fantasy squad assets
          </span>
          {assets.map(({ asset, manager, points }) => (
            <Link
              key={asset.id}
              href={`/league/world-cup-draft/manager/${manager.id}`}
              className="-mx-2 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex min-w-0 items-center gap-2">
                <PositionChip position={asset.position} />
                <span className="truncate text-sm font-semibold">{asset.name}</span>
                <span className="truncate text-xs text-muted-foreground">{manager.name}</span>
              </div>
              <PointsPill points={points} size="sm" />
            </Link>
          ))}
        </div>
      )}

      {isAdmin && (
        <div className="flex items-center justify-between border-t border-border/60 pt-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {match.locked ? (
              <>
                <Lock className="h-3.5 w-3.5" /> Locked · events reviewed
              </>
            ) : (
              <>
                <LockOpen className="h-3.5 w-3.5" /> Unlocked · awaiting review
              </>
            )}
          </span>
          <Button size="sm" variant={match.locked ? "outline" : "default"} onClick={onToggleLock}>
            {match.locked ? "Unlock" : "Lock"}
          </Button>
        </div>
      )}
    </div>
  );
}
