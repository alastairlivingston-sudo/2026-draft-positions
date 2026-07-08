import { NextResponse } from "next/server";

import { DEFAULT_SCORING_VALUES } from "@/lib/scoring";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  auditLogEntryToRow,
  fantasyEventToRow,
  managerToRow,
  manualAdjustmentToRow,
  matchToRow,
  scoringValuesToRow,
  squadAssetToRow,
} from "@/lib/supabase/mappers";
import {
  SEED_AUDIT_LOG,
  SEED_FANTASY_EVENTS,
  SEED_MANAGERS,
  SEED_MANUAL_ADJUSTMENTS,
  SEED_MATCHES,
  SEED_SQUAD_ASSETS,
} from "@/lib/data/seed";

export interface SeedResult {
  ok?: true;
  error?: string;
  steps: { table: string; count: number }[];
}

/**
 * Idempotent one-time load of the curated seed data into Supabase - this
 * *is* the real league (managers, squads, match schedule, curated events),
 * not sample/demo data. Upserts by primary key, so re-running it (e.g.
 * after a schema change) is safe and just overwrites rows with the current
 * seed values rather than duplicating them.
 *
 * No auth gate - the admin dashboard is open to anyone with the link,
 * same as the rest of the app. Insert order follows the schema's foreign
 * keys: managers -> squad assets -> matches -> scoring rules -> fantasy
 * events -> manual adjustments -> audit log.
 */
export async function POST() {
  const steps: { table: string; count: number }[] = [];

  try {
    const supabase = createSupabaseAdminClient();
    const managers = SEED_MANAGERS.map(managerToRow);
    if (managers.length > 0) {
      const { error } = await supabase.from("managers").upsert(managers);
      if (error) throw new Error(`Seeding managers failed: ${error.message}`);
      steps.push({ table: "managers", count: managers.length });
    }

    const squadAssets = SEED_SQUAD_ASSETS.map(squadAssetToRow);
    if (squadAssets.length > 0) {
      const { error } = await supabase.from("squad_assets").upsert(squadAssets);
      if (error) throw new Error(`Seeding squad_assets failed: ${error.message}`);
      steps.push({ table: "squad_assets", count: squadAssets.length });
    }

    const matches = SEED_MATCHES.map(matchToRow);
    if (matches.length > 0) {
      const { error } = await supabase.from("matches").upsert(matches);
      if (error) throw new Error(`Seeding matches failed: ${error.message}`);
      steps.push({ table: "matches", count: matches.length });
    }

    const { error: scoringError } = await supabase.from("scoring_rules").upsert([scoringValuesToRow(DEFAULT_SCORING_VALUES)]);
    if (scoringError) throw new Error(`Seeding scoring_rules failed: ${scoringError.message}`);
    steps.push({ table: "scoring_rules", count: 1 });

    const fantasyEvents = SEED_FANTASY_EVENTS.map(fantasyEventToRow);
    if (fantasyEvents.length > 0) {
      const { error } = await supabase.from("fantasy_events").upsert(fantasyEvents);
      if (error) throw new Error(`Seeding fantasy_events failed: ${error.message}`);
      steps.push({ table: "fantasy_events", count: fantasyEvents.length });
    }

    const manualAdjustments = SEED_MANUAL_ADJUSTMENTS.map(manualAdjustmentToRow);
    if (manualAdjustments.length > 0) {
      const { error } = await supabase.from("manual_adjustments").upsert(manualAdjustments);
      if (error) throw new Error(`Seeding manual_adjustments failed: ${error.message}`);
      steps.push({ table: "manual_adjustments", count: manualAdjustments.length });
    }

    const auditLog = SEED_AUDIT_LOG.map(auditLogEntryToRow);
    if (auditLog.length > 0) {
      const { error } = await supabase.from("audit_log").upsert(auditLog);
      if (error) throw new Error(`Seeding audit_log failed: ${error.message}`);
      steps.push({ table: "audit_log", count: auditLog.length });
    }
  } catch (error) {
    console.error("[/api/admin/seed] failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Seed failed", steps }, { status: 500 });
  }

  return NextResponse.json({ ok: true, steps });
}
