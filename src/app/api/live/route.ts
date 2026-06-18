import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { getApiProvider, isMockMode } from "@/lib/api";

const DEFAULT_CACHE_SECONDS = 60 * 60;

const getLiveData = unstable_cache(
  async () => {
    const provider = getApiProvider();
    const matches = await provider.getMatches();
    // Pass live AND completed matches: a match's goal/assist/card events
    // are only ever fetched here, and only while we ask for them. If we
    // only asked while "live", any match whose live window was missed
    // (e.g. it started and finished within one cache window, see
    // LIVE_DATA_CACHE_SECONDS below) would permanently lose those events.
    // EspnProvider.getLiveEvents dedupes safely against re-processing.
    const eventMatches = matches.filter((m) => m.status === "live" || m.status === "completed");
    const events = eventMatches.length > 0 ? await provider.getLiveEvents(eventMatches) : [];
    const nonAppearingAssetIds = (await provider.getNonAppearingAssetIds?.(matches)) ?? [];
    return { matches, events, nonAppearingAssetIds, fetchedAt: new Date().toISOString() };
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
      nonAppearingAssetIds: [],
      fetchedAt: new Date().toISOString(),
      source: isMockMode() ? "mock" : "api",
    });
  }
}
