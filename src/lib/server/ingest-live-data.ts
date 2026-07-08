import "server-only";

import { getApiProvider, isMockMode } from "@/lib/api";
import { computeMatchResultEvents, DEFAULT_SCORING_VALUES, materializeFantasyEvents, RESULT_EVENT_TYPES } from "@/lib/scoring";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fantasyEventToRow, matchFromRow, matchToRow, scoringValuesFromRow, squadAssetFromRow } from "@/lib/supabase/mappers";
import type { Match, RawApiEvent } from "@/lib/types";

export interface IngestResult {
  skipped?: string;
  source?: "mock" | "api";
  matchesUpserted: number;
  resultEventsUpserted: number;
  liveEventsUpserted: number;
}

/**
 * Server-side counterpart of the client store's syncMatches/ingestApiEvents
 * (src/lib/store/league-store.ts), but writing to the shared Supabase
 * tables instead of one browser's localStorage. Fetches the live provider
 * once, merges match status/score into `matches`, and derives + upserts
 * both result-based events (clean sheets, team bonuses - recomputed fresh
 * for every completed, unlocked match, same rationale as syncMatches) and
 * live keyEvents-based events (goals, cards, assists) into `fantasy_events`,
 * deduped by the table's `event_hash` unique constraint instead of a
 * per-browser cache.
 *
 * No-ops entirely while NEXT_PUBLIC_USE_SUPABASE is off, so the scheduled
 * cron and the admin "refresh now" trigger are inert until the backend is
 * actually cut over.
 */
export async function ingestLiveData(): Promise<IngestResult> {
  if (!isSupabaseEnabled()) {
    return { skipped: "Supabase backend disabled (NEXT_PUBLIC_USE_SUPABASE is not \"true\")", matchesUpserted: 0, resultEventsUpserted: 0, liveEventsUpserted: 0 };
  }

  const supabase = createSupabaseAdminClient();

  const [{ data: matchRows, error: matchesError }, { data: assetRows, error: assetsError }, { data: scoringRow, error: scoringError }] =
    await Promise.all([
      supabase.from("matches").select("*"),
      supabase.from("squad_assets").select("*"),
      supabase.from("scoring_rules").select("*").eq("id", 1).maybeSingle(),
    ]);
  if (matchesError) throw new Error(`Loading matches failed: ${matchesError.message}`);
  if (assetsError) throw new Error(`Loading squad_assets failed: ${assetsError.message}`);
  if (scoringError) throw new Error(`Loading scoring_rules failed: ${scoringError.message}`);

  const dbMatches = (matchRows ?? []).map(matchFromRow);
  const squadAssets = (assetRows ?? []).map(squadAssetFromRow);
  const scoringValues = scoringRow ? scoringValuesFromRow(scoringRow) : DEFAULT_SCORING_VALUES;
  const dbMatchesById = new Map(dbMatches.map((m) => [m.id, m]));
  const assetsById = new Map(squadAssets.map((a) => [a.id, a]));

  const provider = getApiProvider();
  const apiMatches = await provider.getMatches();

  const matchesToUpsert: Match[] = [];
  const matchesToRederive: Match[] = [];

  for (const apiMatch of apiMatches) {
    const existing = dbMatchesById.get(apiMatch.id);
    if (existing?.locked) continue;

    const merged: Match = existing
      ? { ...existing, status: apiMatch.status, homeScore: apiMatch.homeScore, awayScore: apiMatch.awayScore, minute: apiMatch.minute, winner: apiMatch.winner ?? null }
      : apiMatch;

    matchesToUpsert.push(merged);
    if (merged.status === "completed") matchesToRederive.push(merged);
  }

  let matchesUpserted = 0;
  if (matchesToUpsert.length > 0) {
    const { error } = await supabase.from("matches").upsert(matchesToUpsert.map(matchToRow));
    if (error) throw new Error(`Upserting matches failed: ${error.message}`);
    matchesUpserted = matchesToUpsert.length;
  }

  const cleanSheetIneligibleAssetIds = (await provider.getCleanSheetIneligibleAssetIds?.(apiMatches)) ?? {};
  const nonPlayingFor = (matchId: string) => new Set(cleanSheetIneligibleAssetIds[matchId] ?? []);

  let resultEventsUpserted = 0;
  if (matchesToRederive.length > 0) {
    const rederiveIds = matchesToRederive.map((m) => m.id);
    // Result events are derived purely from the final score, so every
    // completed/unlocked match's stale auto-derived events are replaced
    // wholesale on each run rather than patched - matches syncMatches'
    // rationale for a live provider correcting an earlier wrong score.
    const { error: deleteError } = await supabase
      .from("fantasy_events")
      .delete()
      .in("match_id", rederiveIds)
      .neq("source", "seed")
      .in("type", RESULT_EVENT_TYPES);
    if (deleteError) throw new Error(`Clearing stale result events failed: ${deleteError.message}`);

    const resultRawEvents: RawApiEvent[] = matchesToRederive.flatMap((match) =>
      computeMatchResultEvents(match, squadAssets, nonPlayingFor(match.id)),
    );
    const resultEvents = materializeFantasyEvents(resultRawEvents, assetsById, scoringValues, "api");
    if (resultEvents.length > 0) {
      const { error } = await supabase.from("fantasy_events").upsert(resultEvents.map(fantasyEventToRow), {
        onConflict: "event_hash",
        ignoreDuplicates: true,
      });
      if (error) throw new Error(`Upserting result events failed: ${error.message}`);
      resultEventsUpserted = resultEvents.length;
    }
  }

  const eventMatches = apiMatches.filter((m) => m.status === "live" || m.status === "completed");
  const rawLiveEvents = eventMatches.length > 0 ? await provider.getLiveEvents(eventMatches) : [];
  const liveEvents = materializeFantasyEvents(rawLiveEvents, assetsById, scoringValues, isMockMode() ? "mock" : "api");

  let liveEventsUpserted = 0;
  if (liveEvents.length > 0) {
    const { error } = await supabase.from("fantasy_events").upsert(liveEvents.map(fantasyEventToRow), {
      onConflict: "event_hash",
      ignoreDuplicates: true,
    });
    if (error) throw new Error(`Upserting live events failed: ${error.message}`);
    liveEventsUpserted = liveEvents.length;
  }

  return { source: isMockMode() ? "mock" : "api", matchesUpserted, resultEventsUpserted, liveEventsUpserted };
}
