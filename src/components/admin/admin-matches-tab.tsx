"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Pencil } from "lucide-react";

import { CountryFlag } from "@/components/shared/country-flag";
import { MatchStatusBadge } from "@/components/shared/match-status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLeagueStore } from "@/lib/store/league-store";
import type { Match, MatchStatus } from "@/lib/types";

const STATUSES: MatchStatus[] = ["upcoming", "live", "completed"];

export function AdminMatchesTab() {
  const matches = useLeagueStore((s) => s.matches);
  const toggleMatchLock = useLeagueStore((s) => s.toggleMatchLock);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Scores and status sync automatically from the live provider. Use the edit button to
        correct a result by hand - e.g. for a fixture not yet covered by live data, or to fix
        a wrong score. Marking a match &quot;Completed&quot; immediately awards clean sheet and
        team result bonuses for the score entered.
      </p>
      {matches.map((match) => (
        <div key={match.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2 text-sm font-bold">
              <CountryFlag countryCode={match.homeCountryCode} />
              {match.homeTeam}
              <span className="text-muted-foreground">
                {match.homeScore !== null && match.awayScore !== null
                  ? `${match.homeScore} - ${match.awayScore}`
                  : "vs"}
              </span>
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
          <EditResultDialog match={match} />
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

function EditResultDialog({ match }: { match: Match }) {
  const updateMatchResult = useLeagueStore((s) => s.updateMatchResult);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<MatchStatus>(match.status);
  const [homeScore, setHomeScore] = useState(match.homeScore?.toString() ?? "");
  const [awayScore, setAwayScore] = useState(match.awayScore?.toString() ?? "");
  const [minute, setMinute] = useState(match.minute?.toString() ?? "");

  function handleOpenChange(next: boolean) {
    if (next) {
      setStatus(match.status);
      setHomeScore(match.homeScore?.toString() ?? "");
      setAwayScore(match.awayScore?.toString() ?? "");
      setMinute(match.minute?.toString() ?? "");
    }
    setOpen(next);
  }

  function handleSave() {
    updateMatchResult(match.id, {
      status,
      homeScore: homeScore === "" ? null : Number(homeScore),
      awayScore: awayScore === "" ? null : Number(awayScore),
      minute: minute === "" ? null : Number(minute),
    });
    setOpen(false);
  }

  const willCompleteNow = status === "completed" && match.status !== "completed";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Edit match result" />}>
        <Pencil className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Edit result · {match.homeTeam} vs {match.awayTeam}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as MatchStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{match.homeTeam} score</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={homeScore}
                onChange={(e) => setHomeScore(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{match.awayTeam} score</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={awayScore}
                onChange={(e) => setAwayScore(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Minute</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
            />
          </div>
          {willCompleteNow && (
            <p className="text-xs text-muted-foreground">
              Saving will mark this match completed and award clean sheet / team result bonuses
              based on the score above.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleSave}>Save result</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
