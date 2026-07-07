import { NextResponse } from "next/server";

import { ingestLiveData } from "@/lib/server/ingest-live-data";
import { isCronRequestAuthorized } from "@/lib/server/route-auth";

/**
 * Scheduled entry point (see vercel.json's `crons`) for the Supabase-backed
 * live-data pipeline - fetches ESPN, derives events server-side, and
 * upserts into the shared Supabase tables. Replaces the old per-browser
 * ingestApiEvents/syncMatches flow once NEXT_PUBLIC_USE_SUPABASE is on;
 * ingestLiveData() itself no-ops while that flag is off.
 */
export async function GET(request: Request) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await ingestLiveData();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/cron/ingest] failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ingest failed" }, { status: 500 });
  }
}
