"use client";

import { MatchCard } from "@/components/matches/match-card";
import { getMatchAssets } from "@/lib/selectors";
import { useLeagueStore } from "@/lib/store/league-store";
import type { MatchStatus } from "@/lib/types";

const STATUS_ORDER: Record<MatchStatus, number> = { live: 0, upcoming: 1, completed: 2 };

interface MatchesViewProps {
  isAdmin: boolean;
}

export function MatchesView({ isAdmin }: MatchesViewProps) {
  const data = useLeagueStore((s) => s);
  const toggleMatchLock = useLeagueStore((s) => s.toggleMatchLock);

  const matches = data.matches.slice().sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;
    return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
  });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {matches.map((match) => {
        const assets = getMatchAssets(data, match).map(({ asset, manager }) => {
          const points = data.fantasyEvents
            .filter((e) => e.assetId === asset.id && e.matchId === match.id)
            .reduce((sum, e) => sum + e.points, 0);
          return { asset, manager, points };
        });

        return (
          <MatchCard
            key={match.id}
            match={match}
            assets={assets}
            isAdmin={isAdmin}
            onToggleLock={() => toggleMatchLock(match.id)}
          />
        );
      })}
    </div>
  );
}
