import { NextResponse } from "next/server";

import { ingestLiveData } from "@/lib/server/ingest-live-data";
import { isAdminRequestAuthorized } from "@/lib/server/route-auth";

/**
 * On-demand version of the scheduled /api/cron/ingest, for an admin who
 * doesn't want to wait for the next cron tick (e.g. right after a match
 * finishes). Same ingest path, just triggered manually and gated by the
 * admin secret instead of the cron secret.
 */
export async function POST(request: Request) {
  if (!isAdminRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await ingestLiveData();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/admin/refresh] failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Refresh failed" }, { status: 500 });
  }
}
