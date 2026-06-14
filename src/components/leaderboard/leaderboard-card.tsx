import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { RankBadge } from "@/components/leaderboard/rank-badge";
import { CountryFlag } from "@/components/shared/country-flag";
import { ManagerAvatar } from "@/components/shared/manager-avatar";
import { RankChange } from "@/components/shared/rank-change";
import { cn } from "@/lib/utils";
import type { LeaderboardRow } from "@/lib/selectors";

interface LeaderboardCardProps {
  row: LeaderboardRow;
}

export function LeaderboardCard({ row }: LeaderboardCardProps) {
  const { manager, rank, rankChange, total, change, bestAsset, remainingAssets, squadSize } = row;

  return (
    <Link
      href={`/league/world-cup-draft/manager/${manager.id}`}
      className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3 transition-all hover:border-primary/40 hover:bg-card/80 active:scale-[0.99] sm:gap-4 sm:p-4"
    >
      <RankBadge rank={rank} />
      <ManagerAvatar manager={manager} size="lg" className="hidden sm:flex" />
      <ManagerAvatar manager={manager} size="md" className="sm:hidden" />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-base font-extrabold sm:text-lg">{manager.name}</span>
          <RankChange rankChange={rankChange} />
        </div>
        {bestAsset ? (
          <div className="flex items-center gap-1 truncate text-xs text-muted-foreground sm:text-sm">
            <CountryFlag countryCode={bestAsset.asset.countryCode} className="text-sm" />
            <span className="truncate">
              Top asset: <span className="font-semibold text-foreground/80">{bestAsset.asset.name}</span>
            </span>
            <span className="font-bold text-primary">+{bestAsset.points}</span>
          </div>
        ) : null}
        <div className="text-[11px] text-muted-foreground sm:text-xs">
          {remainingAssets}/{squadSize} assets still to play
        </div>
      </div>

      <div className="flex flex-col items-end gap-0.5">
        <span className="text-2xl font-black tabular-nums sm:text-3xl">{total}</span>
        <span
          className={cn(
            "text-[11px] font-bold tabular-nums sm:text-xs",
            change > 0 && "text-primary",
            change < 0 && "text-destructive",
            change === 0 && "text-muted-foreground",
          )}
        >
          {change > 0 ? `+${change}` : change} today
        </span>
      </div>
      <ChevronRight className="hidden h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
    </Link>
  );
}
