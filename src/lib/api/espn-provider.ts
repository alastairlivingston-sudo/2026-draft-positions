import { countryCode } from "@/lib/countries";
import { ESPN_FIXTURE_ID_MAP, ESPN_SCOREBOARD_DATE_RANGE } from "@/lib/data/espn-fixture-map";
import { SEED_MATCHES, SEED_SQUAD_ASSETS } from "@/lib/data/seed";
import { CLEAN_SHEET_MIN_MINUTES, CLEAN_SHEET_POSITIONS } from "@/lib/scoring";
import type { FantasyEventType, Match, MatchStatus, RawApiEvent, SquadAsset } from "@/lib/types";
import type { ApiProvider } from "./types";

const BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";

/** Maps ESPN's competition.status.type.state onto our MatchStatus. */
const STATE_MAP: Record<string, MatchStatus> = {
  pre: "upcoming",
  in: "live",
  post: "completed",
};

export interface EspnCompetitor {
  homeAway: "home" | "away";
  score?: string;
  /** ESPN flags the actual winner even when the goal score is level (a
   *  penalty-shootout result), so we can award the right team_win. */
  winner?: boolean;
  team?: { displayName: string };
}

/** Which side ESPN marks as the winner, for shootout ties the score hides. */
function resolveWinner(
  home: EspnCompetitor | undefined,
  away: EspnCompetitor | undefined,
): "home" | "away" | null {
  if (home?.winner) return "home";
  if (away?.winner) return "away";
  return null;
}

export interface EspnEvent {
  id: string;
  /** ISO date-time, e.g. "2026-06-29T17:00Z". */
  date: string;
  /** e.g. { slug: "round-of-32" } - used to label dynamically-discovered knockout fixtures. */
  season?: { slug?: string };
  competitions: {
    status: { clock: number; type: { state: string } };
    competitors: EspnCompetitor[];
    venue?: { fullName?: string };
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

/** A single player's roster entry from ESPN's summary "rosters" array. */
export interface EspnRosterPlayer {
  /** True if the player started the match. */
  starter?: boolean;
  /** True if the player came on as a substitute at some point. */
  subbedIn?: boolean;
  athlete?: { displayName: string };
}

export interface EspnRosterGroup {
  homeAway: "home" | "away";
  roster: EspnRosterPlayer[];
}

/** A single penalty kick from ESPN's "shootout" array - a separate top-level
 *  field from keyEvents, only present on matches that went to penalties. */
export interface EspnShootoutShot {
  player?: string;
  didScore: boolean;
}

export interface EspnShootoutTeam {
  team: string;
  shots: EspnShootoutShot[];
}

export interface EspnSummaryResponse {
  keyEvents?: EspnKeyEvent[];
  rosters?: EspnRosterGroup[];
  /** Penalty-by-penalty shootout record, present only when the match went to penalties. */
  shootout?: EspnShootoutTeam[];
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

/** Lowercases and strips diacritics/punctuation for country-name matching,
 *  e.g. ESPN's "Curaçao" -> "curacao" to match our "Curacao". Unlike
 *  normalizeName() above, word order is preserved - country names are always
 *  in a fixed order. */
function normalizeCountryName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z\s]/g, "")
    .trim();
}

const SQUAD_COUNTRY_NAMES = new Set(SEED_SQUAD_ASSETS.map((asset) => asset.country));

const NORMALIZED_SQUAD_COUNTRIES = new Map(
  [...SQUAD_COUNTRY_NAMES].map((country) => [normalizeCountryName(country), country]),
);

/** ESPN scoreboard team names that don't normalize to a match against our
 *  squad country names (e.g. ESPN's "South Korea"/"United States"/"Turkey"
 *  vs our "Korea"/"USA"/"Türkiye"), keyed by normalizeCountryName(). */
const ESPN_COUNTRY_NAME_ALIASES: Record<string, string> = {
  "south korea": "Korea",
  "korea republic": "Korea",
  "united states": "USA",
  turkey: "Türkiye",
};

/** Resolves an ESPN team display name to the exact country string used by
 *  SquadAsset.country / Match.homeTeam/awayTeam, so dynamically-discovered
 *  fixtures plug straight into computeMatchResultEvents's exact-string
 *  matching. Returns undefined for teams with no squad relevance (e.g.
 *  knockout-bracket placeholders like "Group C Winner", or countries not
 *  picked by any manager). */
export function resolveSquadCountry(espnDisplayName: string | undefined): string | undefined {
  if (!espnDisplayName) return undefined;
  const normalized = normalizeCountryName(espnDisplayName);
  return ESPN_COUNTRY_NAME_ALIASES[normalized] ?? NORMALIZED_SQUAD_COUNTRIES.get(normalized);
}

/** ESPN's season.slug values for knockout rounds, mapped to display labels.
 *  Keys must match ESPN's actual slugs exactly - the live feed uses the plural
 *  "quarterfinals"/"semifinals" and "3rd-place-match", not the singular forms;
 *  singular aliases are kept too in case ESPN varies them. */
const STAGE_LABELS: Record<string, string> = {
  "round-of-32": "Round of 32",
  "round-of-16": "Round of 16",
  quarterfinals: "Quarter-final",
  quarterfinal: "Quarter-final",
  semifinals: "Semi-final",
  semifinal: "Semi-final",
  "3rd-place-match": "Third-place playoff",
  "third-place": "Third-place playoff",
  final: "Final",
};

function stageLabel(slug: string | undefined): string {
  if (!slug) return "Knockout Stage";
  return STAGE_LABELS[slug] ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** ESPN numeric event ids already covered by ESPN_FIXTURE_ID_MAP, so
 *  discoverDynamicMatches never re-adds a statically-mapped fixture. */
const KNOWN_ESPN_IDS = new Set(Object.values(ESPN_FIXTURE_ID_MAP));

/**
 * Scans ESPN scoreboard events not already covered by ESPN_FIXTURE_ID_MAP
 * (i.e. knockout-round fixtures, whose matchups aren't known until the group
 * stage concludes) for any that involve a country picked by a squad, and
 * synthesizes Match objects for them. Purely additive - never touches the
 * statically-mapped, already-validated SEED_MATCHES entries.
 */
export function discoverDynamicMatches(events: EspnEvent[]): Match[] {
  const discovered: Match[] = [];

  for (const event of events) {
    const espnId = Number(event.id);
    if (KNOWN_ESPN_IDS.has(espnId)) continue;

    const comp = event.competitions[0];
    const home = comp.competitors.find((c) => c.homeAway === "home");
    const away = comp.competitors.find((c) => c.homeAway === "away");
    if (!home || !away) continue;

    const homeCountry = resolveSquadCountry(home.team?.displayName);
    const awayCountry = resolveSquadCountry(away.team?.displayName);
    if (!homeCountry && !awayCountry) continue;

    const homeTeam = homeCountry ?? home.team?.displayName ?? "TBD";
    const awayTeam = awayCountry ?? away.team?.displayName ?? "TBD";
    const status = STATE_MAP[comp.status.type.state] ?? "upcoming";
    const isUpcoming = status === "upcoming";

    discovered.push({
      id: `espn-${espnId}`,
      stage: stageLabel(event.season?.slug),
      homeTeam,
      homeCountryCode: countryCode(homeTeam),
      awayTeam,
      awayCountryCode: countryCode(awayTeam),
      kickoff: event.date,
      status,
      homeScore: isUpcoming ? null : Number(home.score ?? 0),
      awayScore: isUpcoming ? null : Number(away.score ?? 0),
      minute: isUpcoming ? null : Math.floor(comp.status.clock / 60),
      winner: isUpcoming ? null : resolveWinner(home, away),
      venue: comp.venue?.fullName ?? "",
      locked: false,
    });
  }

  return discovered;
}

/** Resolves a Match id to its ESPN numeric event id, for both
 *  statically-mapped fixtures (ESPN_FIXTURE_ID_MAP) and
 *  dynamically-discovered ones (id format "espn-<espnId>", see
 *  discoverDynamicMatches). */
function resolveEspnId(matchId: string): number | undefined {
  if (ESPN_FIXTURE_ID_MAP[matchId] !== undefined) return ESPN_FIXTURE_ID_MAP[matchId];
  const dynamicId = matchId.match(/^espn-(\d+)$/);
  return dynamicId ? Number(dynamicId[1]) : undefined;
}

/** Returns true for any ESPN event type that represents a scored goal.
 *  Matches "goal" (standard) or any "goal---*" subtype (header, volley,
 *  free-kick, etc.) plus "penalty---scored". own-goal has its own handling
 *  below. The prefix approach means new ESPN goal subtypes are covered
 *  automatically without needing to update an allowlist. */
function isGoalEvent(type: string): boolean {
  return type === "goal" || type.startsWith("goal---") || type === "penalty---scored";
}

/** Finds the squad GK who was on the pitch for a given side of a match,
 *  from the ESPN roster data. Returns undefined if no squad GK appeared. */
function findActiveSquadGk(rosters: EspnRosterGroup[] | undefined, side: "home" | "away"): SquadAsset | undefined {
  const roster = rosters?.find((r) => r.homeAway === side)?.roster ?? [];
  for (const entry of roster) {
    if (!entry.starter && !entry.subbedIn) continue;
    const asset = findPlayerAsset(entry.athlete?.displayName);
    if (asset?.position === "Goalkeeper") return asset;
  }
  return undefined;
}

/** Determines which side of a match a penalty taker belongs to, so the
 *  defending keeper can be identified. Tries the taker's squad country first,
 *  then falls back to parsing "(Country)" from the event text. */
function findDefendingSide(
  event: EspnKeyEvent,
  match: Match,
): "home" | "away" | undefined {
  const takerName = event.participants?.[0]?.athlete.displayName;
  const takerCountry =
    findPlayerAsset(takerName)?.country ??
    (() => {
      const m = event.text?.match(/^[^(]*\(([^)]+)\)/);
      return m ? (resolveSquadCountry(m[1]) ?? m[1]) : undefined;
    })();
  if (!takerCountry) return undefined;
  if (takerCountry === match.homeTeam) return "away";
  if (takerCountry === match.awayTeam) return "home";
  return undefined;
}

/** Finds the squad GK who should receive penalty_saved credit for a missed
 *  in-play penalty. For penalty---saved events, ESPN names the keeper in the
 *  event text ("...by [Name] ([Country])."), so we try that first. For
 *  penalty---missed (wide/post), we fall back to the roster. */
function findKeeperForPenaltyMiss(
  event: EspnKeyEvent,
  match: Match,
  rosters: EspnRosterGroup[] | undefined,
): SquadAsset | undefined {
  if (event.type.type === "penalty---saved") {
    const m = event.text?.match(/\bby ([^(]+?)\s*\(/);
    if (m) {
      const keeper = findPlayerAsset(m[1].trim());
      if (keeper) return keeper;
    }
  }
  const side = findDefendingSide(event, match);
  return side ? findActiveSquadGk(rosters, side) : undefined;
}

interface MatchContext {
  match: Match;
  rosters: EspnRosterGroup[] | undefined;
}

function mapKeyEvent(fixtureId: string, event: EspnKeyEvent, ctx?: MatchContext): RawApiEvent[] {
  const type = event.type.type;
  const minute = parseMinute(event.clock.displayValue);
  const detail = event.text ?? "";
  const participants = event.participants ?? [];

  if (isGoalEvent(type)) {
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

  // Any non-scored penalty (saved OR missed target) counts as penalty_missed
  // for the taker and penalty_saved for the opposing keeper.
  // penalty---scored is caught by isGoalEvent above.
  if (type.includes("penalty")) {
    const events: RawApiEvent[] = [];
    const taker = findPlayerAsset(participants[0]?.athlete.displayName);
    if (taker) events.push({ fixtureId, assetId: taker.id, type: "penalty_missed", minute, detail });
    if (ctx) {
      const keeper = findKeeperForPenaltyMiss(event, ctx.match, ctx.rosters);
      if (keeper) events.push({ fixtureId, assetId: keeper.id, type: "penalty_saved", minute, detail });
    }
    return events;
  }

  return [];
}

/** Minute recorded against shootout-derived events - shots have no clock of
 *  their own, so this matches the "Start Shootout" keyEvent's minute. */
const SHOOTOUT_MINUTE = 120;

/** Resolves an ESPN shootout team name to "home" or "away" for a given match,
 *  so the opposing keeper can be looked up from rosters. */
function resolveShootoutTeamSide(teamName: string, match: Match): "home" | "away" | undefined {
  if (teamName === match.homeTeam) return "home";
  if (teamName === match.awayTeam) return "away";
  const resolved = resolveSquadCountry(teamName);
  if (resolved === match.homeTeam) return "home";
  if (resolved === match.awayTeam) return "away";
  return undefined;
}

/** Maps a match's penalty shootout onto fantasy events. A converted kick
 *  scores as a goal for the taker; a missed kick scores as penalty_missed for
 *  the taker and penalty_saved for the opposing squad GK (if one was playing). */
function mapShootoutEvents(
  fixtureId: string,
  shootout: EspnShootoutTeam[] | undefined,
  match?: Match,
  rosters?: EspnRosterGroup[],
): RawApiEvent[] {
  const events: RawApiEvent[] = [];
  for (const team of shootout ?? []) {
    const keeperSide =
      match
        ? (() => {
            const s = resolveShootoutTeamSide(team.team, match);
            return s === "home" ? "away" : s === "away" ? "home" : undefined;
          })()
        : undefined;

    team.shots.forEach((shot, index) => {
      const player = findPlayerAsset(shot.player);
      const shotNumber = index + 1;
      const detail = shot.didScore
        ? `${shot.player} scores penalty shootout kick ${shotNumber}`
        : `${shot.player} misses penalty shootout kick ${shotNumber}`;

      if (player) {
        events.push({
          fixtureId,
          assetId: player.id,
          type: shot.didScore ? "goal" : "penalty_missed",
          minute: SHOOTOUT_MINUTE,
          detail,
        });
      }

      if (!shot.didScore && keeperSide) {
        const keeper = findActiveSquadGk(rosters, keeperSide);
        if (keeper) {
          events.push({ fixtureId, assetId: keeper.id, type: "penalty_saved", minute: SHOOTOUT_MINUTE, detail });
        }
      }
    });
  }
  return events;
}

/** Countries with at least one squad GK/Defender, for whom a clean sheet
 *  bonus is fantasy-relevant. */
const CLEAN_SHEET_COUNTRIES = new Set(
  SEED_SQUAD_ASSETS.filter((a) => a.assetType === "player" && CLEAN_SHEET_POSITIONS.includes(a.position)).map(
    (a) => a.country,
  ),
);

/** Standard match length used to estimate minutes played for a starter who
 *  was never subbed off, or a substitute who was on for the rest of the
 *  match - stoppage time isn't reported per-player by ESPN, so this is an
 *  approximation, but it's only ever compared against the 60-minute
 *  threshold, which it's not close to either boundary of. */
const STANDARD_MATCH_MINUTES = 90;

/** Per-player substitution clock minutes derived from a match's keyEvents
 *  feed, keyed by ESPN's athlete.displayName (matched against the same
 *  source's roster names, so no normalization is needed here). */
interface SubstitutionMinutes {
  subbedInAt: Map<string, number>;
  subbedOutAt: Map<string, number>;
}

function parseSubstitutionMinutes(keyEvents: EspnKeyEvent[] | undefined): SubstitutionMinutes {
  const subbedInAt = new Map<string, number>();
  const subbedOutAt = new Map<string, number>();
  for (const event of keyEvents ?? []) {
    if (event.type.type !== "substitution") continue;
    const minute = parseMinute(event.clock.displayValue);
    const [playerIn, playerOut] = event.participants ?? [];
    if (playerIn?.athlete?.displayName) subbedInAt.set(playerIn.athlete.displayName, minute);
    if (playerOut?.athlete?.displayName) subbedOutAt.set(playerOut.athlete.displayName, minute);
  }
  return { subbedInAt, subbedOutAt };
}

/**
 * Estimates how many minutes a roster entry was on the pitch, using the
 * match's substitution events. Returns undefined when it can't be
 * determined (no substitution data available for an entry flagged as a
 * substitute) - callers should treat that as "assume eligible" rather than
 * guessing, since most matches' keyEvents are unaffected and a false
 * exclusion is worse than a rare missed one.
 */
function estimateMinutesPlayed(entry: EspnRosterPlayer, subs: SubstitutionMinutes): number | undefined {
  const name = entry.athlete?.displayName;
  if (!name) return undefined;

  if (entry.subbedIn) {
    const subbedInAt = subs.subbedInAt.get(name);
    if (subbedInAt === undefined) return undefined;
    const subbedOutAt = subs.subbedOutAt.get(name);
    return (subbedOutAt ?? STANDARD_MATCH_MINUTES) - subbedInAt;
  }

  const subbedOutAt = subs.subbedOutAt.get(name);
  return subbedOutAt ?? STANDARD_MATCH_MINUTES;
}

/**
 * For a completed match where one side conceded 0, finds that side's
 * squad GK/Defender asset ids who aren't eligible for the automatic
 * clean_sheet bonus per ESPN's roster/keyEvents data - either because they
 * never appeared at all (not in the starting XI and never subbed on), or
 * because they appeared but were on the pitch for under
 * CLEAN_SHEET_MIN_MINUTES (started and subbed off early, or came on too
 * late as a substitute). Used by computeMatchResultEvents (src/lib/scoring.ts),
 * which otherwise assumes every squad GK/Defender for that country played
 * the full match.
 */
export function findCleanSheetIneligibleAssetIds(json: EspnSummaryResponse, match: Match): string[] {
  if (match.homeScore === null || match.awayScore === null) return [];

  const sides: { team: string; conceded: number; homeAway: "home" | "away" }[] = [
    { team: match.homeTeam, conceded: match.awayScore, homeAway: "home" },
    { team: match.awayTeam, conceded: match.homeScore, homeAway: "away" },
  ];

  const subs = parseSubstitutionMinutes(json.keyEvents);
  const ids: string[] = [];
  for (const side of sides) {
    if (side.conceded !== 0 || !CLEAN_SHEET_COUNTRIES.has(side.team)) continue;

    const roster = json.rosters?.find((r) => r.homeAway === side.homeAway)?.roster ?? [];
    for (const entry of roster) {
      const asset = findPlayerAsset(entry.athlete?.displayName);
      if (!asset || asset.country !== side.team || !CLEAN_SHEET_POSITIONS.includes(asset.position)) continue;

      if (!entry.starter && !entry.subbedIn) {
        ids.push(asset.id);
        continue;
      }

      const minutesPlayed = estimateMinutesPlayed(entry, subs);
      if (minutesPlayed !== undefined && minutesPlayed < CLEAN_SHEET_MIN_MINUTES) {
        ids.push(asset.id);
      }
    }
  }
  return ids;
}

/**
 * Adapter for ESPN's free, unauthenticated public scoreboard API - no key
 * required, unlike API-Football (whose free tier doesn't cover the 2026
 * season at all).
 *
 * Fixture identities for the group stage are resolved via
 * src/lib/data/espn-fixture-map.ts, which maps SEED_MATCHES ids to ESPN's
 * numeric event ids for World Cup 2026 Group Stage · Matchday 1-3
 * (m1-m66). Knockout-round fixtures (Round of 32 onward) aren't pre-mapped
 * - discoverDynamicMatches() finds them automatically once ESPN's bracket
 * is populated, for any fixture involving a country picked by a squad.
 *
 * Coverage notes:
 * - Goals, assists, yellow/red cards and own goals are derived from each
 *   live or completed fixture's keyEvents feed, matched to squad players
 *   by name. Completed matches are re-checked (not just live ones) so a
 *   match whose live window was missed entirely still gets backfilled.
 * - Penalty shootouts (knockout draws) are reported in a separate
 *   "shootout" field, not keyEvents - see mapShootoutEvents. A converted
 *   kick scores as a goal, a missed kick as penalty_missed.
 * - Penalty saves (in regular play or a shootout) are automatically awarded
 *   to the opposing squad GK via findKeeperForPenaltyMiss / mapShootoutEvents.
 * - Clean sheets and team win/loss/3+ bonuses need no player/team mapping
 *   at all - they're derived locally from the final score by
 *   computeMatchResultEvents (src/lib/scoring.ts) once a match is
 *   reported as completed.
 */
export class EspnProvider implements ApiProvider {
  async getMatches(): Promise<Match[]> {
    const res = await fetch(`${BASE_URL}/scoreboard?dates=${ESPN_SCOREBOARD_DATE_RANGE}&limit=150`, {
      cache: "no-store",
    });
    if (!res.ok) return SEED_MATCHES;

    const json = (await res.json()) as EspnScoreboardResponse;
    const byEspnId = new Map(json.events.map((event) => [Number(event.id), event]));

    const mapped = SEED_MATCHES.map((seedMatch) => {
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
        winner: isUpcoming ? null : resolveWinner(home, away),
      };
    });

    return [...mapped, ...discoverDynamicMatches(json.events)];
  }

  async getLiveEvents(matches: Match[]): Promise<RawApiEvent[]> {
    // Includes "completed" matches, not just "live" ones: if a match's
    // entire live window falls between two cron ticks (see
    // .github/workflows/ingest-cron.yml),
    // its goal/assist/card key-events would otherwise never be fetched -
    // only the final-score-derived bonuses (clean sheet, team result,
    // computed locally in computeMatchResultEvents) would land, silently
    // dropping individual player events. Re-fetching for already-processed
    // completed matches is safe and cheap: the ingest job dedupes by event
    // hash (see src/lib/server/ingest-live-data.ts), so this is purely a
    // self-healing backfill, not a source of double-counting.
    const relevantMatches = matches.filter(
      (m) => (m.status === "live" || m.status === "completed") && resolveEspnId(m.id) !== undefined,
    );
    if (relevantMatches.length === 0) return [];

    const perMatch = await Promise.all(
      relevantMatches.map(async (match) => {
        const espnId = resolveEspnId(match.id);
        const res = await fetch(`${BASE_URL}/summary?event=${espnId}`, { cache: "no-store" });
        if (!res.ok) return [];

        const json = (await res.json()) as EspnSummaryResponse;
        return [
          ...(json.keyEvents ?? []).flatMap((event) => mapKeyEvent(match.id, event, { match, rosters: json.rosters })),
          ...mapShootoutEvents(match.id, json.shootout, match, json.rosters),
        ];
      }),
    );

    return perMatch.flat();
  }

  async getCleanSheetIneligibleAssetIds(matches: Match[]): Promise<Record<string, string[]>> {
    const candidates = matches.filter((m) => {
      if (m.status !== "completed" || m.homeScore === null || m.awayScore === null) return false;
      if (resolveEspnId(m.id) === undefined) return false;
      const homeKeptCleanSheet = m.awayScore === 0 && CLEAN_SHEET_COUNTRIES.has(m.homeTeam);
      const awayKeptCleanSheet = m.homeScore === 0 && CLEAN_SHEET_COUNTRIES.has(m.awayTeam);
      return homeKeptCleanSheet || awayKeptCleanSheet;
    });
    if (candidates.length === 0) return {};

    const perMatch = await Promise.all(
      candidates.map(async (match): Promise<[string, string[]]> => {
        const espnId = resolveEspnId(match.id);
        const res = await fetch(`${BASE_URL}/summary?event=${espnId}`, { cache: "no-store" });
        if (!res.ok) return [match.id, []];

        const json = (await res.json()) as EspnSummaryResponse;
        return [match.id, findCleanSheetIneligibleAssetIds(json, match)];
      }),
    );

    // Keyed per-match: a GK/Defender absent here may have started (and
    // kept a clean sheet) in another fixture, so these exclusions must
    // never leak across matches. Drop empty entries to keep it compact.
    return Object.fromEntries(perMatch.filter(([, ids]) => ids.length > 0));
  }
}
