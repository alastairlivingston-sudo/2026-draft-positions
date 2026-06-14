import type { Match, RawApiEvent } from "@/lib/types";

/**
 * Adapter contract for a sports-data provider. Implementations:
 * - MockProvider: deterministic, in-memory data so the app works with
 *   zero configuration.
 * - ApiFootballProvider: stub for https://www.api-football.com/, wired
 *   up using API_FOOTBALL_KEY.
 */
export interface ApiProvider {
  /** Fetches the latest state (status/score/minute) for tracked matches. */
  getMatches(): Promise<Match[]>;

  /**
   * Fetches new fantasy-relevant events (goals, cards, etc.) for matches
   * that are currently live. Callers should dedupe using the event hash
   * (fixtureId + assetId + minute + type + detail) before persisting.
   */
  getLiveEvents(matches: Match[]): Promise<RawApiEvent[]>;
}
