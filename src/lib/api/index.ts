import { ApiFootballProvider } from "./api-football-provider";
import { mockProvider } from "./mock-provider";
import type { ApiProvider } from "./types";

/**
 * Returns the active sports-data provider.
 *
 * Defaults to the mock provider so the app works with zero
 * configuration. Set `NEXT_PUBLIC_USE_MOCK_DATA=false` and
 * `API_FOOTBALL_KEY` to switch to the (stubbed) API-Football provider
 * once it's implemented.
 */
export function getApiProvider(): ApiProvider {
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";
  const apiKey = process.env.API_FOOTBALL_KEY;

  if (!useMock && apiKey) {
    return new ApiFootballProvider(apiKey);
  }

  return mockProvider;
}

export type { ApiProvider } from "./types";
