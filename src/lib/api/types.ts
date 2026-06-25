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
   * that are live or completed - completed matches are included so a
   * match whose entire live window was missed (e.g. it started and
   * finished within one cache window) still gets its events backfilled.
   * Callers should dedupe using the event hash (fixtureId + assetId +
   * minute + type + detail) before persisting.
   */
  getLiveEvents(matches: Match[]): Promise<RawApiEvent[]>;

  /**
   * Optional: for completed matches where a clean sheet is possible,
   * returns - keyed by match id - the squad GK/Defender asset ids that
   * aren't eligible for the clean_sheet bonus in that match (per provider
   * roster/substitution data): either they never appeared at all, or they
   * were on the pitch for under the 60-minute threshold (started and came
   * off early, or came on too late as a substitute). Used so
   * computeMatchResultEvents can skip their bonus for that match
   * specifically. Keyed per-match because a player can sit out one fixture
   * (no clean sheet there) yet start and keep one in another - a flat,
   * match-agnostic list would suppress the bonus everywhere.
   * Only EspnProvider implements this - other providers have no roster data.
   */
  getCleanSheetIneligibleAssetIds?(matches: Match[]): Promise<Record<string, string[]>>;
}
