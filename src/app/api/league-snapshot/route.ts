import { NextResponse } from "next/server";

import { isSupabaseEnabled } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  auditLogEntryFromRow,
  fantasyEventFromRow,
  managerFromRow,
  manualAdjustmentFromRow,
  matchFromRow,
  scoringValuesFromRow,
  squadAssetFromRow,
} from "@/lib/supabase/mappers";
import { DEFAULT_SCORING_VALUES } from "@/lib/scoring";
import type { LeagueData } from "@/lib/selectors";

/**
 * Read-only snapshot of the whole league, shaped to match `LeagueData`
 * (src/lib/selectors.ts) so it can hydrate the client store directly - see
 * useSupabaseSnapshotPolling. Public read (RLS allows it via the anon key,
 * same as any other viewer), so this needs no admin secret; it 404s while
 * NEXT_PUBLIC_USE_SUPABASE is off since nothing should be polling it yet.
 */
export async function GET() {
  if (!isSupabaseEnabled()) {
    return NextResponse.json({ error: "Supabase backend disabled" }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();

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
  if (firstError) {
    console.error("[/api/league-snapshot] failed:", firstError);
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const data: LeagueData = {
    managers: (managers.data ?? []).map(managerFromRow),
    squadAssets: (squadAssets.data ?? []).map(squadAssetFromRow),
    matches: (matches.data ?? []).map(matchFromRow),
    fantasyEvents: (fantasyEvents.data ?? []).map(fantasyEventFromRow),
    manualAdjustments: (manualAdjustments.data ?? []).map(manualAdjustmentFromRow),
    scoringValues: scoringRules.data ? scoringValuesFromRow(scoringRules.data) : DEFAULT_SCORING_VALUES,
    auditLog: (auditLog.data ?? []).map(auditLogEntryFromRow),
  };

  return NextResponse.json({ ...data, fetchedAt: new Date().toISOString() });
}
