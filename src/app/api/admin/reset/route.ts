import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface ResetResult {
  ok?: true;
  error?: string;
  cleared: string[];
}

/**
 * Wipes every row from every league table - a clean slate before
 * re-seeding, e.g. to recover from a bad ingest or duplicate events.
 * Deletes in reverse-of-seed-insert order (children before parents) so
 * foreign keys never block a delete. `scoring_rules` is left alone since
 * it's a single fixed row (id = 1) that seeding always overwrites in
 * place anyway - nothing to "clear" there.
 *
 * No auth gate - the admin dashboard is open to anyone with the link,
 * same as the rest of the app. This is the one genuinely destructive
 * admin action, so the confirmation lives client-side (see
 * AdminResetButton) rather than here.
 */
export async function POST() {
  const supabase = createSupabaseAdminClient();
  const cleared: string[] = [];

  try {
    const { error: auditError } = await supabase.from("audit_log").delete().neq("id", "__never_matches__");
    if (auditError) throw new Error(`Clearing audit_log failed: ${auditError.message}`);
    cleared.push("audit_log");

    const { error: adjustmentsError } = await supabase.from("manual_adjustments").delete().neq("id", "__never_matches__");
    if (adjustmentsError) throw new Error(`Clearing manual_adjustments failed: ${adjustmentsError.message}`);
    cleared.push("manual_adjustments");

    const { error: eventsError } = await supabase.from("fantasy_events").delete().neq("id", "__never_matches__");
    if (eventsError) throw new Error(`Clearing fantasy_events failed: ${eventsError.message}`);
    cleared.push("fantasy_events");

    const { error: assetsError } = await supabase.from("squad_assets").delete().neq("id", "__never_matches__");
    if (assetsError) throw new Error(`Clearing squad_assets failed: ${assetsError.message}`);
    cleared.push("squad_assets");

    const { error: matchesError } = await supabase.from("matches").delete().neq("id", "__never_matches__");
    if (matchesError) throw new Error(`Clearing matches failed: ${matchesError.message}`);
    cleared.push("matches");

    const { error: managersError } = await supabase.from("managers").delete().neq("id", "__never_matches__");
    if (managersError) throw new Error(`Clearing managers failed: ${managersError.message}`);
    cleared.push("managers");

    const { error: cacheError } = await supabase.from("api_event_cache").delete().neq("hash", "__never_matches__");
    if (cacheError) throw new Error(`Clearing api_event_cache failed: ${cacheError.message}`);
    cleared.push("api_event_cache");
  } catch (error) {
    console.error("[/api/admin/reset] failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Reset failed", cleared }, { status: 500 });
  }

  return NextResponse.json({ ok: true, cleared });
}
