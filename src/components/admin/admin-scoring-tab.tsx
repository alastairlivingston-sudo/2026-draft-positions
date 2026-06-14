"use client";

import { useState } from "react";
import { RefreshCw, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
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

export function AdminScoringTab() {
  const scoringValues = useLeagueStore((s) => s.scoringValues);
  const updateScoringValues = useLeagueStore((s) => s.updateScoringValues);
  const recalculateAllPoints = useLeagueStore((s) => s.recalculateAllPoints);

  const [values, setValues] = useState<ScoringValues>(scoringValues);
  const [mode, setMode] = useState<"forward" | "recalculate">("forward");

  function setValue(key: keyof ScoringValues, raw: string) {
    const num = Number(raw);
    setValues((prev) => ({ ...prev, [key]: Number.isNaN(num) ? 0 : num }));
  }

  function handleSave() {
    updateScoringValues(values, mode);
  }

  function renderField(key: keyof ScoringValues) {
    const info = SCORING_LABELS[key];
    return (
      <div key={key} className="flex flex-col gap-1.5">
        <Label htmlFor={key}>{info.label}</Label>
        <Input id={key} type="number" value={values[key]} onChange={(e) => setValue(key, e.target.value)} />
        <span className="text-[11px] text-muted-foreground">{info.description}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Player events</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{PLAYER_KEYS.map(renderField)}</div>

        <Separator />

        <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Team bonuses</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{TEAM_KEYS.map(renderField)}</div>

        <Separator />

        <div className="flex flex-col gap-2">
          <Label>When saving, apply changes to</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setMode("forward")}
              className={cn(
                "flex-1 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                mode === "forward" ? "border-primary bg-primary/10 text-foreground" : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="block font-bold">Future events only</span>
              <span className="block text-xs">Already-awarded points stay as they were.</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("recalculate")}
              className={cn(
                "flex-1 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                mode === "recalculate" ? "border-primary bg-primary/10 text-foreground" : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="block font-bold">Recalculate history</span>
              <span className="block text-xs">Every past event is rescored with the new values.</span>
            </button>
          </div>
        </div>

        <Button onClick={handleSave} className="self-start">
          <Save className="h-4 w-4" />
          Save scoring rules
        </Button>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Recalculate now</h3>
        <p className="text-sm text-muted-foreground">
          Recompute every fantasy event using the currently saved scoring rules - useful after fixing a squad
          asset&apos;s position or asset type.
        </p>
        <Button variant="outline" onClick={() => recalculateAllPoints()} className="self-start">
          <RefreshCw className="h-4 w-4" />
          Recalculate all points
        </Button>
      </div>
    </div>
  );
}
