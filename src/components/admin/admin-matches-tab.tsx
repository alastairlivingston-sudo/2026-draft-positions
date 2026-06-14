"use client";

import { format } from "date-fns";

import { CountryFlag } from "@/components/shared/country-flag";
import { MatchStatusBadge } from "@/components/shared/match-status-badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLeagueStore } from "@/lib/store/league-store";

export function AdminMatchesTab() {
  const matches = useLeagueStore((s) => s.matches);
  const toggleMatchLock = useLeagueStore((s) => s.toggleMatchLock);

  return (
    <div className="flex flex-col gap-2">
      {matches.map((match) => (
        <div key={match.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2 text-sm font-bold">
              <CountryFlag countryCode={match.homeCountryCode} />
              {match.homeTeam}
              <span className="text-muted-foreground">vs</span>
              {match.awayTeam}
              <CountryFlag countryCode={match.awayCountryCode} />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{match.stage}</span>
              <span>·</span>
              <span>{format(new Date(match.kickoff), "EEE d MMM · HH:mm")}</span>
              <MatchStatusBadge status={match.status} minute={match.minute} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Label htmlFor={`lock-${match.id}`} className="text-xs text-muted-foreground">
              {match.locked ? "Locked" : "Unlocked"}
            </Label>
            <Switch id={`lock-${match.id}`} checked={match.locked} onCheckedChange={() => toggleMatchLock(match.id)} />
          </div>
        </div>
      ))}
    </div>
  );
}
