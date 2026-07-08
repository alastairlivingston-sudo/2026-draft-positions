import { NextResponse } from "next/server";

import { fetchLeagueDataFromSupabase } from "@/lib/server/league-data";
import { isSupabaseEnabled } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  try {
    const data = await fetchLeagueDataFromSupabase(supabase);
    return NextResponse.json({ ...data, fetchedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[/api/league-snapshot] failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Snapshot failed" }, { status: 500 });
  }
}
