import { NextResponse } from "next/server";

import { ingestLiveData } from "@/lib/server/ingest-live-data";

/**
 * On-demand version of the scheduled /api/cron/ingest, for an admin who
 * doesn't want to wait for the next cron tick (e.g. right after a match
 * finishes). Same ingest path, just triggered manually. No auth gate -
 * the admin dashboard is open to anyone with the link, same as the rest
 * of the app.
 */
export async function POST() {
  try {
    const result = await ingestLiveData();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/admin/refresh] failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Refresh failed" }, { status: 500 });
  }
}
