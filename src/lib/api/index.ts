import { ApiFootballProvider } from "./api-football-provider";
import { EspnProvider } from "./espn-provider";
import { mockProvider } from "./mock-provider";
import type { ApiProvider } from "./types";

/**
 * True unless `NEXT_PUBLIC_USE_MOCK_DATA=false` - i.e. whenever
 * `getApiProvider()` would return the mock provider.
 */
export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";
}

/**
 * Returns the active sports-data provider.
 *
 * Defaults to the mock provider so the app works with zero
 * configuration. Set `NEXT_PUBLIC_USE_MOCK_DATA=false` to switch to
 * `EspnProvider`, which pulls live World Cup 2026 scores/events from
 * ESPN's free public scoreboard API - no key required.
 *
 * If `API_FOOTBALL_KEY` is also set, the legacy `ApiFootballProvider`
 * is used instead (see src/lib/data/api-football-mapping.ts) - note
 * its free tier does not cover the 2026 World Cup.
 */
export function getApiProvider(): ApiProvider {
  if (isMockMode()) return mockProvider;

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (apiKey) return new ApiFootballProvider(apiKey);

  return new EspnProvider();
}

export type { ApiProvider } from "./types";
