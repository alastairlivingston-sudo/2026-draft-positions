import { ChevronRight } from "lucide-react";

import { CountryFlag } from "@/components/shared/country-flag";
import { PointsPill } from "@/components/shared/points-pill";
import { PositionChip } from "@/components/shared/position-chip";
import { cn } from "@/lib/utils";
import type { SquadAsset } from "@/lib/types";

interface SquadRowProps {
  asset: SquadAsset;
  points: number;
  eventCount: number;
  stillToPlay: boolean;
  remainingGames: number;
  eliminated?: boolean;
  onClick?: () => void;
}

export function SquadRow({
  asset,
  points,
  eventCount,
  stillToPlay,
  remainingGames,
  eliminated = false,
  onClick,
}: SquadRowProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-[72px] w-full items-center gap-3 rounded-2xl border border-border/60 bg-card p-3 text-left transition-colors hover:border-primary/30 active:scale-[0.99]",
        eliminated && "opacity-50 grayscale",
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-lg">
        <CountryFlag countryCode={asset.countryCode} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-bold sm:text-base">{asset.name}</span>
        <div className="flex items-center gap-2">
          <PositionChip position={asset.position} />
          <span className="truncate text-xs text-muted-foreground">{asset.country}</span>
          {asset.unavailable && (
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">
              Unavailable
            </span>
          )}
          {stillToPlay && (
            <>
              <span
                className="relative flex h-2 w-2 shrink-0 sm:hidden"
                role="img"
                aria-label="Still to play"
                title="Still to play"
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
              </span>
              <span className="hidden rounded-full bg-sky-400/15 px-2 py-0.5 text-[10px] font-bold text-sky-300 sm:inline">
                {remainingGames} {remainingGames === 1 ? "game" : "games"} left
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <PointsPill points={points} size="lg" />
        <span className={cn("text-[11px] text-muted-foreground", eventCount === 0 && "opacity-60")}>
          {eventCount} {eventCount === 1 ? "event" : "events"}
        </span>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
