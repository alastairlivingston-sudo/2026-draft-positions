"use client";

import { useLiveStatus } from "@/lib/contexts/live-status-context";
import type { AddAdjustmentInput, AddEventInput, AdminActionRequest, UpdateEventInput } from "@/lib/store/mutations";
import type { Match, ScoringValues, SquadAsset } from "@/lib/types";

async function callMutate(action: AdminActionRequest["action"], args: unknown[]): Promise<void> {
  const res = await fetch("/api/admin/mutate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, args }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
}

export interface LeagueActions {
  addFantasyEvent: (input: AddEventInput) => void;
  updateFantasyEvent: (id: string, patch: UpdateEventInput, reason: string) => void;
  deleteFantasyEvent: (id: string, reason: string) => void;
  addManualAdjustment: (input: AddAdjustmentInput) => void;
  deleteManualAdjustment: (id: string, reason: string) => void;
  updateScoringValues: (values: ScoringValues, mode: "forward" | "recalculate") => void;
  recalculateAllPoints: () => void;
  toggleMatchLock: (matchId: string) => void;
  updateMatchResult: (matchId: string, patch: Partial<Pick<Match, "status" | "homeScore" | "awayScore" | "minute">>) => void;
  updateSquadAsset: (
    id: string,
    patch: Partial<Pick<SquadAsset, "name" | "country" | "position" | "assetType" | "unavailable">>,
  ) => void;
}

/**
 * The admin dashboard's (and the public Match Centre's lock toggle) write
 * actions - every one POSTs to /api/admin/mutate, which dispatches to the
 * matching apply* function in src/lib/store/mutations.ts against Supabase,
 * then triggers an immediate snapshot re-poll so the change is visible
 * without waiting for the next interval. Failures are surfaced with an
 * alert since these actions have no other error-handling UI - e.g. a
 * viewer who hasn't logged in via /admin trying to toggle a match lock.
 */
export function useLeagueActions(): LeagueActions {
  const { refresh } = useLiveStatus();

  function run(action: AdminActionRequest["action"], args: unknown[]) {
    callMutate(action, args)
      .then(() => refresh())
      .catch((error) => {
        console.error(`[useLeagueActions] ${action} failed:`, error);
        window.alert(error instanceof Error ? error.message : "That action failed - please try again.");
      });
  }

  return {
    addFantasyEvent: (input) => run("addFantasyEvent", [input]),
    updateFantasyEvent: (id, patch, reason) => run("updateFantasyEvent", [id, patch, reason]),
    deleteFantasyEvent: (id, reason) => run("deleteFantasyEvent", [id, reason]),
    addManualAdjustment: (input) => run("addManualAdjustment", [input]),
    deleteManualAdjustment: (id, reason) => run("deleteManualAdjustment", [id, reason]),
    updateScoringValues: (values, mode) => run("updateScoringValues", [values, mode]),
    recalculateAllPoints: () => run("recalculateAllPoints", []),
    toggleMatchLock: (matchId) => run("toggleMatchLock", [matchId]),
    updateMatchResult: (matchId, patch) => run("updateMatchResult", [matchId, patch]),
    updateSquadAsset: (id, patch) => run("updateSquadAsset", [id, patch]),
  };
}
