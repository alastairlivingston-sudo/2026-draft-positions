import { ApiFootballProvider } from "./api-football-provider";
import { mockProvider } from "./mock-provider";
import type { ApiProvider } from "./types";

/**
 * True unless `NEXT_PUBLIC_USE_MOCK_DATA=false` and `API_FOOTBALL_KEY`
 * is set - i.e. whenever `getApiProvider()` would return the mock
 * provider.
 */
export function isMockMode(): boolean {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";
  return useMock || !process.env.API_FOOTBALL_KEY;
}

/**
 * Returns the active sports-data provider.
 *
 * Defaults to the mock provider so the app works with zero
 * configuration. Set `NEXT_PUBLIC_USE_MOCK_DATA=false` and
 * `API_FOOTBALL_KEY` to switch to the API-Football provider (see
 * src/lib/data/api-football-mapping.ts for the ID-mapping setup it
 * needs).
 */
export function getApiProvider(): ApiProvider {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (isMockMode() || !apiKey) return mockProvider;

  return new ApiFootballProvider(apiKey);
}

export type { ApiProvider } from "./types";
