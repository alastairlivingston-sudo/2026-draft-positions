import type { Match, RawApiEvent } from "@/lib/types";
import type { ApiProvider } from "./types";

/**
 * Placeholder adapter for https://www.api-football.com/.
 *
 * To wire this up for real:
 * 1. Set `API_FOOTBALL_KEY` in your environment.
 * 2. Add an `external_id` column (or a mapping table) so
 *    `squad_assets`/`matches` rows can be matched against
 *    API-Football fixture/team/player IDs.
 * 3. Implement `getMatches` to call `${this.baseUrl}/fixtures` for the
 *    configured tournament + date range, mapping the response onto the
 *    `Match` shape (status, scores, minute).
 * 4. Implement `getLiveEvents` to call `${this.baseUrl}/fixtures/events`
 *    for each live fixture, map each event to a `squad_assets.id` via
 *    the lookup table, and translate API-Football event types/details
 *    into `FantasyEventType` ("Goal" + "Normal Goal" -> "goal", "Card" +
 *    "Yellow Card" -> "yellow_card", etc.)
 *
 * Until implemented, this provider returns empty results so the app
 * falls back gracefully if it's selected without full integration.
 */
export class ApiFootballProvider implements ApiProvider {
  private readonly baseUrl = "https://v3.football.api-sports.io";

  constructor(private readonly apiKey: string) {}

  private get headers(): Record<string, string> {
    return { "x-apisports-key": this.apiKey };
  }

  async getMatches(): Promise<Match[]> {
    // const res = await fetch(`${this.baseUrl}/fixtures?league=1&season=2026`, { headers: this.headers });
    // const json = await res.json();
    // return json.response.map(mapFixtureToMatch);
    return [];
  }

  async getLiveEvents(): Promise<RawApiEvent[]> {
    // const res = await fetch(`${this.baseUrl}/fixtures/events?fixture=${fixtureId}`, { headers: this.headers });
    // const json = await res.json();
    // return json.response.map(mapApiEventToRawApiEvent).filter(Boolean);
    return [];
  }
}
