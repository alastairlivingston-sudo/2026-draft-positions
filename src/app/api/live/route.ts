import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { getApiProvider, isMockMode } from "@/lib/api";

const DEFAULT_CACHE_SECONDS = 60 * 60;

const getLiveData = unstable_cache(
  async () => {
    const provider = getApiProvider();
    const matches = await provider.getMatches();
    const liveMatches = matches.filter((m) => m.status === "live");
    const events = liveMatches.length > 0 ? await provider.getLiveEvents(liveMatches) : [];
    return { matches, events, fetchedAt: new Date().toISOString() };
  },
  ["live-data"],
  { revalidate: Number(process.env.LIVE_DATA_CACHE_SECONDS) || DEFAULT_CACHE_SECONDS },
);

/**
 * Shared live-data endpoint. The upstream provider is only called once
 * per `LIVE_DATA_CACHE_SECONDS` window (default 1 hour) via
 * `unstable_cache`, regardless of how many clients poll this route -
 * keeping API-Football usage well within its free-tier quota.
 *
 * `getApiProvider`/`isMockMode` rely on `API_FOOTBALL_KEY`, which is a
 * server-only env var - this route is the only place that can resolve
 * the real provider.
 */
export async function GET() {
  try {
    const data = await getLiveData();
    return NextResponse.json({ ...data, source: isMockMode() ? "mock" : "api" });
  } catch (error) {
    console.error("[/api/live] live data fetch failed:", error);
    return NextResponse.json({
      matches: [],
      events: [],
      fetchedAt: new Date().toISOString(),
      source: isMockMode() ? "mock" : "api",
      debugError: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
  }
}
