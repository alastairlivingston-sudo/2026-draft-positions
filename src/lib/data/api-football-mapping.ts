/**
 * Manual ID-mapping for the API-Football integration
 * (src/lib/api/api-football-provider.ts).
 *
 * API-Football identifies fixtures and players with its own numeric
 * IDs, independent of this app's `Match.id` / `squad_assets.id`. Fill
 * in the two maps below once, using your `API_FOOTBALL_KEY`:
 *
 * 1. Fixtures - find the World Cup 2026 fixture IDs:
 *      GET https://v3.football.api-sports.io/fixtures?league=1&season=2026
 *    For each fixture you're tracking, copy `fixture.id` into
 *    FIXTURE_ID_MAP against the matching `Match.id` (m1, m2, ... from
 *    src/lib/data/seed.ts - match on team names/kickoff date).
 *
 * 2. Players - find a player's API-Football ID:
 *      GET https://v3.football.api-sports.io/players?search=<surname>&season=2026
 *    Copy `player.id` into PLAYER_ID_MAP against the matching
 *    `squad_assets.id` (e.g. "ally-1" - see src/lib/data/seed.ts for
 *    the slot order of each manager's squad).
 *
 * "Team" squad assets (e.g. "Qatar Squad") and clean sheets need no
 * mapping at all - those are derived locally from the final score via
 * `computeMatchResultEvents` in src/lib/scoring.ts, matched on
 * `SquadAsset.country`.
 *
 * Until FIXTURE_ID_MAP has entries, ApiFootballProvider has nothing to
 * query and the app behaves as if running in mock mode.
 */

/** Match.id (from seed.ts) -> API-Football fixture ID. */
export const FIXTURE_ID_MAP: Record<string, number> = {
  // m1: 1234567,
};

/** API-Football player ID -> squad_assets.id (from seed.ts). */
export const PLAYER_ID_MAP: Record<number, string> = {
  // 12345: "ally-1",
};
