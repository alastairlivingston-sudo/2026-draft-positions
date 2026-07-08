import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_SCORING_VALUES } from "@/lib/scoring";
import type { LeagueData } from "@/lib/selectors";
import type { Database } from "@/lib/supabase/database.types";
import {
  auditLogEntryFromRow,
  auditLogEntryToRow,
  fantasyEventFromRow,
  fantasyEventToRow,
  managerFromRow,
  managerToRow,
  manualAdjustmentFromRow,
  manualAdjustmentToRow,
  matchFromRow,
  matchToRow,
  scoringValuesFromRow,
  scoringValuesToRow,
  squadAssetFromRow,
  squadAssetToRow,
} from "@/lib/supabase/mappers";

type Client = SupabaseClient<Database>;

/** Loads the whole league as a LeagueData snapshot - shared by /api/league-snapshot and the admin mutate route. */
export async function fetchLeagueDataFromSupabase(supabase: Client): Promise<LeagueData> {
  const [managers, squadAssets, matches, fantasyEvents, manualAdjustments, scoringRules, auditLog] = await Promise.all([
    supabase.from("managers").select("*"),
    supabase.from("squad_assets").select("*"),
    supabase.from("matches").select("*"),
    supabase.from("fantasy_events").select("*"),
    supabase.from("manual_adjustments").select("*"),
    supabase.from("scoring_rules").select("*").eq("id", 1).maybeSingle(),
    supabase.from("audit_log").select("*").order("timestamp", { ascending: false }),
  ]);

  const firstError = [managers, squadAssets, matches, fantasyEvents, manualAdjustments, scoringRules, auditLog].find(
    (result) => result.error,
  )?.error;
  if (firstError) throw new Error(`Loading league data failed: ${firstError.message}`);

  return {
    managers: (managers.data ?? []).map(managerFromRow),
    squadAssets: (squadAssets.data ?? []).map(squadAssetFromRow),
    matches: (matches.data ?? []).map(matchFromRow),
    fantasyEvents: (fantasyEvents.data ?? []).map(fantasyEventFromRow),
    manualAdjustments: (manualAdjustments.data ?? []).map(manualAdjustmentFromRow),
    scoringValues: scoringRules.data ? scoringValuesFromRow(scoringRules.data) : DEFAULT_SCORING_VALUES,
    auditLog: (auditLog.data ?? []).map(auditLogEntryFromRow),
  };
}

function diffIds<T extends { id: string }>(before: T[], after: T[]): { changed: T[]; removedIds: string[] } {
  const afterIds = new Set(after.map((row) => row.id));
  const removedIds = before.filter((row) => !afterIds.has(row.id)).map((row) => row.id);
  return { changed: after, removedIds };
}

/**
 * Writes an admin mutation's result back to Supabase: upserts every row in
 * each changed table (cheap at this league's scale - a handful of managers,
 * ~64 squad assets, a couple hundred events) and deletes any ids present
 * before but missing after. Only touches tables whose array actually
 * changed, so an action like toggleMatchLock (matches + audit_log only)
 * doesn't rewrite fantasy_events for no reason.
 */
export async function writeBackLeagueData(supabase: Client, before: LeagueData, after: LeagueData): Promise<void> {
  if (after.managers !== before.managers) {
    const { changed, removedIds } = diffIds(before.managers, after.managers);
    if (changed.length > 0) await throwOnError(supabase.from("managers").upsert(changed.map(managerToRow)));
    if (removedIds.length > 0) await throwOnError(supabase.from("managers").delete().in("id", removedIds));
  }
  if (after.squadAssets !== before.squadAssets) {
    const { changed, removedIds } = diffIds(before.squadAssets, after.squadAssets);
    if (changed.length > 0) await throwOnError(supabase.from("squad_assets").upsert(changed.map(squadAssetToRow)));
    if (removedIds.length > 0) await throwOnError(supabase.from("squad_assets").delete().in("id", removedIds));
  }
  if (after.matches !== before.matches) {
    const { changed, removedIds } = diffIds(before.matches, after.matches);
    if (changed.length > 0) await throwOnError(supabase.from("matches").upsert(changed.map(matchToRow)));
    if (removedIds.length > 0) await throwOnError(supabase.from("matches").delete().in("id", removedIds));
  }
  if (after.scoringValues !== before.scoringValues) {
    await throwOnError(supabase.from("scoring_rules").upsert([scoringValuesToRow(after.scoringValues)]));
  }
  if (after.fantasyEvents !== before.fantasyEvents) {
    const { changed, removedIds } = diffIds(before.fantasyEvents, after.fantasyEvents);
    if (changed.length > 0) await throwOnError(supabase.from("fantasy_events").upsert(changed.map(fantasyEventToRow)));
    if (removedIds.length > 0) await throwOnError(supabase.from("fantasy_events").delete().in("id", removedIds));
  }
  if (after.manualAdjustments !== before.manualAdjustments) {
    const { changed, removedIds } = diffIds(before.manualAdjustments, after.manualAdjustments);
    if (changed.length > 0) await throwOnError(supabase.from("manual_adjustments").upsert(changed.map(manualAdjustmentToRow)));
    if (removedIds.length > 0) await throwOnError(supabase.from("manual_adjustments").delete().in("id", removedIds));
  }
  if (after.auditLog !== before.auditLog) {
    const { changed, removedIds } = diffIds(before.auditLog, after.auditLog);
    if (changed.length > 0) await throwOnError(supabase.from("audit_log").upsert(changed.map(auditLogEntryToRow)));
    if (removedIds.length > 0) await throwOnError(supabase.from("audit_log").delete().in("id", removedIds));
  }
}

async function throwOnError(query: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await query;
  if (error) throw new Error(error.message);
}
