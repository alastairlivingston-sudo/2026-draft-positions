import { ESPN_FIXTURE_ID_MAP, ESPN_SCOREBOARD_DATE_RANGE } from "@/lib/data/espn-fixture-map";
import { SEED_MATCHES, SEED_SQUAD_ASSETS } from "@/lib/data/seed";
import type { FantasyEventType, Match, MatchStatus, RawApiEvent, SquadAsset } from "@/lib/types";
import type { ApiProvider } from "./types";

const BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";

/** Maps ESPN's competition.status.type.state onto our MatchStatus. */
const STATE_MAP: Record<string, MatchStatus> = {
  pre: "upcoming",
  in: "live",
  post: "completed",
};

interface EspnCompetitor {
  homeAway: "home" | "away";
  score?: string;
}

interface EspnEvent {
  id: string;
  competitions: {
    status: { clock: number; type: { state: string } };
    competitors: EspnCompetitor[];
  }[];
}

interface EspnScoreboardResponse {
  events: EspnEvent[];
}

interface EspnKeyEvent {
  type: { type: string };
  text?: string;
  clock: { displayValue: string };
  participants?: { athlete: { displayName: string } }[];
}

interface EspnSummaryResponse {
  keyEvents?: EspnKeyEvent[];
}

const PLAYER_ASSETS_BY_NAME = new Map(
  SEED_SQUAD_ASSETS.filter((asset) => asset.assetType === "player").map((asset) => [asset.name, asset]),
);

/** Lowercase, strips diacritics/punctuation, and sorts name tokens so e.g.
 *  "Hwang In-Beom" and "Inbeom Hwang" normalize to the same key - ESPN
 *  often lists Korean players family-name-first, unlike our seed data. */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

const PLAYER_ASSETS_BY_NORMALIZED_NAME = new Map(
  SEED_SQUAD_ASSETS.filter((asset) => asset.assetType === "player").map((asset) => [normalizeName(asset.name), asset]),
);

/** Looks up a squad player by ESPN's athlete.displayName, falling back to a
 *  name-order-independent match for cases like "Hwang In-Beom" vs "Inbeom Hwang". */
function findPlayerAsset(espnName: string | undefined): SquadAsset | undefined {
  if (!espnName) return undefined;
  return PLAYER_ASSETS_BY_NAME.get(espnName) ?? PLAYER_ASSETS_BY_NORMALIZED_NAME.get(normalizeName(espnName));
}

function parseMinute(displayValue: string): number {
  const match = displayValue.match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
}

/** ESPN goal event subtypes confirmed in live World Cup data - "goal" for
 *  standard goals, plus headers/volleys/penalties which use distinct type
 *  strings. Kept as an explicit allowlist (rather than a "goal---" prefix
 *  match) so a possible future "goal---disallowed"-style VAR overturn isn't
 *  miscounted as a scored goal. */
const GOAL_EVENT_TYPES = new Set(["goal", "goal---header", "goal---volley", "penalty---scored"]);

function mapKeyEvent(fixtureId: string, event: EspnKeyEvent): RawApiEvent[] {
  const type = event.type.type;
  const minute = parseMinute(event.clock.displayValue);
  const detail = event.text ?? "";
  const participants = event.participants ?? [];

  if (GOAL_EVENT_TYPES.has(type)) {
    const events: RawApiEvent[] = [];
    const scorer = findPlayerAsset(participants[0]?.athlete.displayName);
    if (scorer) events.push({ fixtureId, assetId: scorer.id, type: "goal", minute, detail });
    const assister = findPlayerAsset(participants[1]?.athlete.displayName);
    if (assister) events.push({ fixtureId, assetId: assister.id, type: "assist", minute, detail });
    return events;
  }

  if (type === "own-goal") {
    const scorer = findPlayerAsset(participants[participants.length - 1]?.athlete.displayName);
    return scorer ? [{ fixtureId, assetId: scorer.id, type: "own_goal", minute, detail }] : [];
  }

  if (type === "yellow-card" || type === "red-card") {
    const player = findPlayerAsset(participants[0]?.athlete.displayName);
    const eventType: FantasyEventType = type === "yellow-card" ? "yellow_card" : "red_card";
    return player ? [{ fixtureId, assetId: player.id, type: eventType, minute, detail }] : [];
  }

  if (type.includes("penalty") && type.includes("missed")) {
    const player = findPlayerAsset(participants[0]?.athlete.displayName);
    return player ? [{ fixtureId, assetId: player.id, type: "penalty_missed", minute, detail }] : [];
  }

  return [];
}

/**
 * Adapter for ESPN's free, unauthenticated public scoreboard API - no key
 * required, unlike API-Football (whose free tier doesn't cover the 2026
 * season at all).
 *
 * Fixture identities are resolved via src/lib/data/espn-fixture-map.ts,
 * which maps SEED_MATCHES ids to ESPN's numeric event ids for World Cup
 * 2026 Group Stage · Matchday 1.
 *
 * Coverage notes:
 * - Goals, assists, yellow/red cards and own goals are derived from each
 *   live fixture's keyEvents feed, matched to squad players by name.
 * - Penalty saves aren't reported as a distinct event and still need to
 *   be logged manually from the admin dashboard.
 * - Clean sheets and team win/loss/3+ bonuses need no player/team mapping
 *   at all - they're derived locally from the final score by
 *   computeMatchResultEvents (src/lib/scoring.ts) once a match is
 *   reported as completed.
 */
export class EspnProvider implements ApiProvider {
  async getMatches(): Promise<Match[]> {
    const res = await fetch(`${BASE_URL}/scoreboard?dates=${ESPN_SCOREBOARD_DATE_RANGE}&limit=100`, {
      cache: "no-store",
    });
    if (!res.ok) return SEED_MATCHES;

    const json = (await res.json()) as EspnScoreboardResponse;
    const byEspnId = new Map(json.events.map((event) => [Number(event.id), event]));

    return SEED_MATCHES.map((seedMatch) => {
      const espnId = ESPN_FIXTURE_ID_MAP[seedMatch.id];
      const event = espnId !== undefined ? byEspnId.get(espnId) : undefined;
      if (!event) return seedMatch;

      const comp = event.competitions[0];
      const status = STATE_MAP[comp.status.type.state] ?? seedMatch.status;
      const home = comp.competitors.find((c) => c.homeAway === "home");
      const away = comp.competitors.find((c) => c.homeAway === "away");
      const isUpcoming = status === "upcoming";

      return {
        ...seedMatch,
        status,
        homeScore: isUpcoming ? null : Number(home?.score ?? 0),
        awayScore: isUpcoming ? null : Number(away?.score ?? 0),
        minute: isUpcoming ? null : Math.floor(comp.status.clock / 60),
      };
    });
  }

  async getLiveEvents(matches: Match[]): Promise<RawApiEvent[]> {
    const liveMatches = matches.filter((m) => m.status === "live" && ESPN_FIXTURE_ID_MAP[m.id] !== undefined);
    if (liveMatches.length === 0) return [];

    const perMatch = await Promise.all(
      liveMatches.map(async (match) => {
        const espnId = ESPN_FIXTURE_ID_MAP[match.id];
        const res = await fetch(`${BASE_URL}/summary?event=${espnId}`, { cache: "no-store" });
        if (!res.ok) return [];

        const json = (await res.json()) as EspnSummaryResponse;
        return (json.keyEvents ?? []).flatMap((event) => mapKeyEvent(match.id, event));
      }),
    );

    return perMatch.flat();
  }
}
