"use client";

import { Shield, ShieldCheck, Users } from "lucide-react";

import { PointsPill } from "@/components/shared/points-pill";
import { SCORING_LABELS } from "@/lib/scoring";
import { useLeagueStore } from "@/lib/store/league-store";
import type { ScoringValues } from "@/lib/types";

const PLAYER_KEYS: (keyof ScoringValues)[] = [
  "goal",
  "assist",
  "cleanSheetDefenderGk",
  "penaltySaved",
  "missedPenalty",
  "yellowCard",
  "redCard",
  "ownGoal",
];

const TEAM_KEYS: (keyof ScoringValues)[] = ["teamWin", "teamScored3Plus", "teamLoss", "teamConceded3Plus"];

export default function RulesPage() {
  const scoringValues = useLeagueStore((s) => s.scoringValues);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Scoring Rules</h1>
        <p className="text-sm text-muted-foreground">How points are awarded across the league</p>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <Users className="h-4 w-4 text-primary" />
          How squads work
        </div>
        <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <li>Every manager drafts exactly 8 squad assets - a mix of individual players and national team rows.</li>
          <li>Player rows score from individual match events: goals, assists, cards, clean sheets and more.</li>
          <li>Team rows score from their nation&apos;s match results - wins, losses and high-scoring games.</li>
          <li>Team bonuses never apply to player rows, and player events never apply to team rows.</li>
          <li>
            Clean sheet points only apply to goalkeepers and defenders, and only if they played 60+ minutes
            without their team conceding while they were on the pitch.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Player events
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {PLAYER_KEYS.map((key) => {
            const info = SCORING_LABELS[key];
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold">{info.label}</span>
                  <span className="text-xs text-muted-foreground">{info.description}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                    {info.appliesTo}
                  </span>
                </div>
                <PointsPill points={scoringValues[key]} size="lg" />
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <Shield className="h-4 w-4 text-accent" />
          Team bonuses
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {TEAM_KEYS.map((key) => {
            const info = SCORING_LABELS[key];
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold">{info.label}</span>
                  <span className="text-xs text-muted-foreground">{info.description}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                    {info.appliesTo}
                  </span>
                </div>
                <PointsPill points={scoringValues[key]} size="lg" />
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Scoring values are set by the league admin and can change between matchdays. Visit the event feed to see
        exactly when and why points were awarded.
      </p>
    </div>
  );
}
