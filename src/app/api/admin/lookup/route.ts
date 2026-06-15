import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";

const BASE_URL = "https://v3.football.api-sports.io";

/**
 * Read-only API-Football endpoints needed to populate
 * src/lib/data/api-football-mapping.ts:
 * - fixtures?league=1&season=2026 - World Cup fixture IDs
 * - teams?league=1&season=2026 - team IDs (for players/squads below)
 * - players/squads?team={id} - a team's full squad with player IDs
 * - players?search={name}&season=2026 - fallback player lookup by name
 */
const ALLOWED_ENDPOINTS = new Set(["fixtures", "teams", "players", "players/squads"]);

/**
 * Admin-gated proxy to API-Football, used to look up the fixture/player
 * IDs needed for src/lib/data/api-football-mapping.ts without exposing
 * API_FOOTBALL_KEY to the browser. Restricted to a small allowlist of
 * read-only endpoints.
 */
export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API_FOOTBALL_KEY is not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint");
  if (!endpoint || !ALLOWED_ENDPOINTS.has(endpoint)) {
    return NextResponse.json(
      { error: `endpoint must be one of: ${[...ALLOWED_ENDPOINTS].join(", ")}` },
      { status: 400 },
    );
  }

  const params = new URLSearchParams(searchParams);
  params.delete("endpoint");

  const res = await fetch(`${BASE_URL}/${endpoint}?${params.toString()}`, {
    headers: { "x-apisports-key": apiKey },
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
