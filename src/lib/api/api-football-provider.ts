import { FIXTURE_ID_MAP, PLAYER_ID_MAP } from "@/lib/data/api-football-mapping";
import { SEED_MATCHES } from "@/lib/data/seed";
import type { FantasyEventType, Match, MatchStatus, RawApiEvent } from "@/lib/types";
import type { ApiProvider } from "./types";

/** Maps API-Football's fixture.status.short codes onto our MatchStatus. */
const STATUS_MAP: Record<string, MatchStatus> = {
  TBD: "upcoming",
  NS: "upcoming",
  PST: "upcoming",
  "1H": "live",
  HT: "live",
  "2H": "live",
  ET: "live",
  BT: "live",
  P: "live",
  SUSP: "live",
  INT: "live",
  FT: "completed",
  AET: "completed",
  PEN: "completed",
  CANC: "completed",
  ABD: "completed",
  AWD: "completed",
  WO: "completed",
};

interface ApiFixtureResponse {
  fixture: { id: number; status: { short: string; elapsed: number | null } };
  goals: { home: number | null; away: number | null };
}

interface ApiEventResponse {
  time: { elapsed: number };
  type: string;
  detail: string;
  player: { id: number | null };
  assist: { id: number | null };
}

/**
 * Adapter for https://www.api-football.com/ (v3).
 *
 * Fixture and player identities are resolved via
 * src/lib/data/api-football-mapping.ts - see that file for setup
 * instructions. Until it's filled in, getMatches/getLiveEvents return
 * empty results and the app behaves as if running in mock mode.
 *
 * Coverage notes:
 * - Goals, assists, yellow/red cards, own goals and missed penalties
 *   are derived from the /fixtures/events feed.
 * - Penalty saves are not reported as a distinct event by API-Football
 *   and must still be logged manually from the admin dashboard.
 * - Clean sheets and team win/loss/3+ bonuses need no player/team
 *   mapping at all - they're derived locally from the final score by
 *   `computeMatchResultEvents` (src/lib/scoring.ts) once a match is
 *   reported as completed.
 */
export class ApiFootballProvider implements ApiProvider {
  private readonly baseUrl = "https://v3.football.api-sports.io";

  constructor(private readonly apiKey: string) {}

  private get headers(): Record<string, string> {
    return { "x-apisports-key": this.apiKey };
  }

  async getMatches(): Promise<Match[]> {
    const fixtureIds = Object.values(FIXTURE_ID_MAP);
    if (fixtureIds.length === 0) return [];

    const res = await fetch(`${this.baseUrl}/fixtures?ids=${fixtureIds.join("-")}`, {
      headers: this.headers,
      cache: "no-store",
    });
    if (!res.ok) return [];

    const json = (await res.json()) as { response: ApiFixtureResponse[] };
    const byApiId = new Map(json.response.map((fixture) => [fixture.fixture.id, fixture]));

    return SEED_MATCHES.flatMap((seedMatch) => {
      const apiId = FIXTURE_ID_MAP[seedMatch.id];
      const fixture = apiId !== undefined ? byApiId.get(apiId) : undefined;
      if (!fixture) return [];

      return [
        {
          ...seedMatch,
          status: STATUS_MAP[fixture.fixture.status.short] ?? seedMatch.status,
          homeScore: fixture.goals.home,
          awayScore: fixture.goals.away,
          minute: fixture.fixture.status.elapsed,
        },
      ];
    });
  }

  async getLiveEvents(matches: Match[]): Promise<RawApiEvent[]> {
    const liveMatches = matches.filter((m) => m.status === "live" && FIXTURE_ID_MAP[m.id] !== undefined);
    if (liveMatches.length === 0) return [];

    const perMatch = await Promise.all(
      liveMatches.map(async (match) => {
        const res = await fetch(`${this.baseUrl}/fixtures/events?fixture=${FIXTURE_ID_MAP[match.id]}`, {
          headers: this.headers,
          cache: "no-store",
        });
        if (!res.ok) return [];

        const json = (await res.json()) as { response: ApiEventResponse[] };
        return json.response.flatMap((event) => mapApiEvent(match.id, event));
      }),
    );

    return perMatch.flat();
  }
}

function mapApiEvent(fixtureId: string, event: ApiEventResponse): RawApiEvent[] {
  const minute = event.time.elapsed;
  const scorerId = event.player.id !== null ? PLAYER_ID_MAP[event.player.id] : undefined;

  if (event.type === "Goal") {
    if (event.detail === "Missed Penalty") {
      return scorerId ? [{ fixtureId, assetId: scorerId, type: "penalty_missed", minute, detail: "Missed penalty" }] : [];
    }
    if (event.detail === "Own Goal") {
      return scorerId ? [{ fixtureId, assetId: scorerId, type: "own_goal", minute, detail: "Own goal" }] : [];
    }

    const events: RawApiEvent[] = [];
    if (scorerId) events.push({ fixtureId, assetId: scorerId, type: "goal", minute, detail: event.detail || "Goal" });
    const assistId = event.assist.id !== null ? PLAYER_ID_MAP[event.assist.id] : undefined;
    if (assistId) events.push({ fixtureId, assetId: assistId, type: "assist", minute, detail: "Assist" });
    return events;
  }

  if (event.type === "Card" && scorerId) {
    const type: FantasyEventType = event.detail === "Yellow Card" ? "yellow_card" : "red_card";
    return [{ fixtureId, assetId: scorerId, type, minute, detail: event.detail || "Card" }];
  }

  return [];
}
