import type { Match, RawApiEvent } from "@/lib/types";

/**
 * Adapter contract for a sports-data provider. Implementations:
 * - mockProvider: deterministic, in-memory data so the app works with
 *   zero configuration.
 * - EspnProvider: pulls live scores/events from ESPN's free public
 *   scoreboard API - no key required. The default once mock mode is
 *   turned off.
 * - ApiFootballProvider: legacy provider for
 *   https://www.api-football.com/, wired up using API_FOOTBALL_KEY.
 *   Its free tier doesn't cover the 2026 World Cup.
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
