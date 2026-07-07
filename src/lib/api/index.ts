import { FIXTURE_ID_MAP } from "@/lib/data/api-football-mapping";

import { ApiFootballProvider } from "./api-football-provider";
import { EspnProvider } from "./espn-provider";
import { mockProvider } from "./mock-provider";
import type { ApiProvider } from "./types";

/**
 * True only when `NEXT_PUBLIC_USE_MOCK_DATA=true` - i.e. whenever
 * `getApiProvider()` would return the mock provider.
 *
 * Live ESPN data is the default now that the tournament is underway: mock mode
 * froze at the seeded group stage and never surfaced dynamically-discovered
 * knockout fixtures (and their team_win/loss bonuses). Set
 * `NEXT_PUBLIC_USE_MOCK_DATA=true` to opt back into the scripted seed data for
 * local development or a demo. If ESPN is unreachable the provider falls back
 * to the seed schedule anyway, so live-by-default can't be worse than mock.
 */
export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
}

/**
 * Returns the active sports-data provider.
 *
 * Defaults to `EspnProvider`, which pulls live World Cup 2026
 * scores/events from ESPN's free public scoreboard API - no key
 * required. Set `NEXT_PUBLIC_USE_MOCK_DATA=true` to use the scripted
 * seed data instead (local dev / demo).
 *
 * If `API_FOOTBALL_KEY` is set *and* `FIXTURE_ID_MAP` has been
 * populated, the legacy `ApiFootballProvider` is used instead (see
 * src/lib/data/api-football-mapping.ts) - note its free tier does not
 * cover the 2026 World Cup. An `API_FOOTBALL_KEY` left over from earlier
 * setup with an empty `FIXTURE_ID_MAP` is ignored, so it can't silently
 * shadow `EspnProvider` with a provider that always returns no data.
 */
export function getApiProvider(): ApiProvider {
  if (isMockMode()) return mockProvider;

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (apiKey && Object.keys(FIXTURE_ID_MAP).length > 0) return new ApiFootballProvider(apiKey);

  return new EspnProvider();
}

export type { ApiProvider } from "./types";
