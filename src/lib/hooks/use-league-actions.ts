"use client";

import { useLiveStatus } from "@/lib/contexts/live-status-context";
import { useLeagueStore, type LeagueStore } from "@/lib/store/league-store";
import type { AdminActionRequest } from "@/lib/store/mutations";

type LeagueActions = Pick<
  LeagueStore,
  | "addFantasyEvent"
  | "updateFantasyEvent"
  | "deleteFantasyEvent"
  | "addManualAdjustment"
  | "deleteManualAdjustment"
  | "updateScoringValues"
  | "recalculateAllPoints"
  | "toggleMatchLock"
  | "updateMatchResult"
  | "updateSquadAsset"
>;

async function callMutate(action: AdminActionRequest["action"], args: unknown[]): Promise<void> {
  const res = await fetch("/api/admin/mutate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, args }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
}

/**
 * Returns the admin dashboard's write actions with the exact same
 * signatures as the Zustand store's (see league-store.ts), so the six
 * admin tab components don't need separate Supabase-aware code paths.
 * When NEXT_PUBLIC_USE_SUPABASE is on, each action instead POSTs to
 * /api/admin/mutate (dispatching to the matching apply* function in
 * src/lib/store/mutations.ts against Supabase) and triggers an immediate
 * snapshot re-poll so the change shows up without waiting for the next
 * interval; failures are surfaced with an alert since these actions have
 * no other error-handling UI. Otherwise it returns the store's own actions
 * unchanged.
 */
export function useLeagueActions(): LeagueActions {
  const store = useLeagueStore();
  const { refresh } = useLiveStatus();

  if (process.env.NEXT_PUBLIC_USE_SUPABASE !== "true") {
    return {
      addFantasyEvent: store.addFantasyEvent,
      updateFantasyEvent: store.updateFantasyEvent,
      deleteFantasyEvent: store.deleteFantasyEvent,
      addManualAdjustment: store.addManualAdjustment,
      deleteManualAdjustment: store.deleteManualAdjustment,
      updateScoringValues: store.updateScoringValues,
      recalculateAllPoints: store.recalculateAllPoints,
      toggleMatchLock: store.toggleMatchLock,
      updateMatchResult: store.updateMatchResult,
      updateSquadAsset: store.updateSquadAsset,
    };
  }

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
