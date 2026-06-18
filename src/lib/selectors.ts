import type {
  AuditLogEntry,
  FantasyEvent,
  Manager,
  ManualAdjustment,
  Match,
  ScoringValues,
  SquadAsset,
} from "@/lib/types";

/** Shape shared by the mock store and (eventually) a Supabase-backed store. */
export interface LeagueData {
  managers: Manager[];
  squadAssets: SquadAsset[];
  matches: Match[];
  fantasyEvents: FantasyEvent[];
  manualAdjustments: ManualAdjustment[];
  scoringValues: ScoringValues;
  auditLog: AuditLogEntry[];
}

export interface LeaderboardRow {
  manager: Manager;
  rank: number;
  previousRank: number;
  total: number;
  previousTotal: number;
  change: number;
  rankChange: number;
  bestAsset: { asset: SquadAsset; points: number } | null;
  remainingAssets: number;
  squadSize: number;
}

/** Total points scored by a single squad asset (events + manual adjustments). */
export function getAssetPoints(data: LeagueData, assetId: string): number {
  const eventPoints = data.fantasyEvents
    .filter((e) => e.assetId === assetId)
    .reduce((sum, e) => sum + e.points, 0);
  const adjustmentPoints = data.manualAdjustments
    .filter((a) => a.assetId === assetId)
    .reduce((sum, a) => sum + a.points, 0);
  return eventPoints + adjustmentPoints;
}

/** Total points for a manager across their whole squad, plus direct manager-level adjustments. */
export function getManagerTotal(data: LeagueData, managerId: string): number {
  const assetIds = data.squadAssets.filter((a) => a.managerId === managerId).map((a) => a.id);
  const assetTotal = assetIds.reduce((sum, id) => sum + getAssetPoints(data, id), 0);
  const directAdjustments = data.manualAdjustments
    .filter((a) => a.managerId === managerId && a.assetId === null)
    .reduce((sum, a) => sum + a.points, 0);
  return assetTotal + directAdjustments;
}

/**
 * "Previous" total = total excluding points from events tied to matches
 * that are currently live. This drives the rank-movement / "today's
 * movers" indicators: the change reflects the most recent live update.
 */
export function getPreviousManagerTotal(data: LeagueData, managerId: string): number {
  const liveMatchIds = new Set(data.matches.filter((m) => m.status === "live").map((m) => m.id));
  if (liveMatchIds.size === 0) return getManagerTotal(data, managerId);

  const assetIds = new Set(data.squadAssets.filter((a) => a.managerId === managerId).map((a) => a.id));
  const liveEventPoints = data.fantasyEvents
    .filter((e) => assetIds.has(e.assetId) && e.matchId && liveMatchIds.has(e.matchId))
    .reduce((sum, e) => sum + e.points, 0);

  return getManagerTotal(data, managerId) - liveEventPoints;
}

export function getManagerAssets(data: LeagueData, managerId: string): SquadAsset[] {
  return data.squadAssets.filter((a) => a.managerId === managerId).sort((a, b) => a.slot - b.slot);
}

/** All fantasy events + manual adjustments for an asset, newest first. */
export function getAssetEventLog(data: LeagueData, assetId: string): FantasyEvent[] {
  return data.fantasyEvents
    .filter((e) => e.assetId === assetId)
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getAssetManualAdjustments(data: LeagueData, assetId: string): ManualAdjustment[] {
  return data.manualAdjustments.filter((a) => a.assetId === assetId);
}

/** Best-performing asset for a manager, ties broken by squad slot order. */
export function getBestAsset(data: LeagueData, managerId: string): { asset: SquadAsset; points: number } | null {
  const assets = getManagerAssets(data, managerId);
  if (assets.length === 0) return null;
  let best = { asset: assets[0], points: getAssetPoints(data, assets[0].id) };
  for (const asset of assets.slice(1)) {
    const points = getAssetPoints(data, asset.id);
    if (points > best.points) best = { asset, points };
  }
  return best;
}

/** Highest-scoring asset across the entire league. */
export function getTopAssetOverall(data: LeagueData): { asset: SquadAsset; manager: Manager; points: number } | null {
  let best: { asset: SquadAsset; manager: Manager; points: number } | null = null;
  for (const asset of data.squadAssets) {
    const points = getAssetPoints(data, asset.id);
    const manager = data.managers.find((m) => m.id === asset.managerId);
    if (!manager) continue;
    if (!best || points > best.points) {
      best = { asset, manager, points };
    }
  }
  return best;
}

/** True if an asset's country still has a match to play (upcoming or in progress). */
export function isAssetStillToPlay(data: LeagueData, asset: SquadAsset): boolean {
  return data.matches.some(
    (m) =>
      (m.status === "upcoming" || m.status === "live") &&
      (m.homeTeam === asset.country || m.awayTeam === asset.country),
  );
}

export function getRemainingAssetsCount(data: LeagueData, managerId: string): number {
  return getManagerAssets(data, managerId).filter((asset) => isAssetStillToPlay(data, asset)).length;
}

function getCountryMatches(data: LeagueData, country: string): Match[] {
  return data.matches.filter((m) => m.homeTeam === country || m.awayTeam === country);
}

/** Number of upcoming/live matches remaining for a country. */
export function getRemainingMatchCount(data: LeagueData, country: string): number {
  return getCountryMatches(data, country).filter((m) => m.status === "upcoming" || m.status === "live").length;
}

/**
 * Best-effort "out of the tournament" signal: true once a country has no
 * upcoming/live matches left and didn't win its most recent completed one.
 * Can false-positive for a team that drew/lost a final group game but still
 * advances on group standings (e.g. as a best third-placed team) until
 * their next fixture is discovered - intended as a soft visual cue, not an
 * authoritative result.
 */
export function isTeamPresumedEliminated(data: LeagueData, country: string): boolean {
  const matches = getCountryMatches(data, country);
  if (matches.length === 0) return false;
  if (matches.some((m) => m.status === "upcoming" || m.status === "live")) return false;

  const last = matches
    .filter((m) => m.status === "completed" && m.homeScore !== null && m.awayScore !== null)
    .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime())[0];
  if (!last) return false;

  const isHome = last.homeTeam === country;
  const teamScore = isHome ? last.homeScore! : last.awayScore!;
  const oppScore = isHome ? last.awayScore! : last.homeScore!;
  return teamScore <= oppScore;
}

/** Squad assets (with their manager) whose country is involved in a given match. */
export function getMatchAssets(data: LeagueData, match: Match): { asset: SquadAsset; manager: Manager }[] {
  return data.squadAssets
    .filter((a) => a.country === match.homeTeam || a.country === match.awayTeam)
    .map((asset) => ({ asset, manager: data.managers.find((m) => m.id === asset.managerId)! }))
    .filter((row) => row.manager);
}

/** Full leaderboard, sorted by rank. Ties broken alphabetically by manager name. */
export function computeLeaderboard(data: LeagueData): LeaderboardRow[] {
  const rows = data.managers.map((manager) => {
    const total = getManagerTotal(data, manager.id);
    const previousTotal = getPreviousManagerTotal(data, manager.id);
    return { manager, total, previousTotal };
  });

  const byTotal = (a: { total: number; manager: Manager }, b: { total: number; manager: Manager }) =>
    b.total - a.total || a.manager.name.localeCompare(b.manager.name);
  const byPrevious = (a: { previousTotal: number; manager: Manager }, b: { previousTotal: number; manager: Manager }) =>
    b.previousTotal - a.previousTotal || a.manager.name.localeCompare(b.manager.name);

  const currentOrder = rows.slice().sort(byTotal);
  const previousOrder = rows.slice().sort(byPrevious);

  const previousRanks = new Map<string, number>();
  previousOrder.forEach((row, index) => previousRanks.set(row.manager.id, index + 1));

  return currentOrder.map((row, index) => {
    const rank = index + 1;
    const previousRank = previousRanks.get(row.manager.id) ?? rank;
    const bestAsset = getBestAsset(data, row.manager.id);
    return {
      manager: row.manager,
      rank,
      previousRank,
      total: row.total,
      previousTotal: row.previousTotal,
      change: row.total - row.previousTotal,
      rankChange: previousRank - rank,
      bestAsset,
      remainingAssets: getRemainingAssetsCount(data, row.manager.id),
      squadSize: getManagerAssets(data, row.manager.id).length,
    };
  });
}

/** Managers with the biggest point swings since the last live update, biggest first. */
export function getTodaysMovers(data: LeagueData, limit = 3): LeaderboardRow[] {
  return computeLeaderboard(data)
    .filter((row) => row.change !== 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, limit);
}

/** All upcoming/live matches, soonest first - used for "still to play" widgets. */
export function getUpcomingMatches(data: LeagueData): Match[] {
  return data.matches
    .filter((m) => m.status === "upcoming" || m.status === "live")
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
}

export function getEventsForMatch(data: LeagueData, matchId: string): FantasyEvent[] {
  return data.fantasyEvents
    .filter((e) => e.matchId === matchId)
    .slice()
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
}

export function getManagerById(data: LeagueData, managerId: string): Manager | undefined {
  return data.managers.find((m) => m.id === managerId);
}

export function getAssetById(data: LeagueData, assetId: string): SquadAsset | undefined {
  return data.squadAssets.find((a) => a.id === assetId);
}

/** All fantasy events + manual adjustments merged into a single feed, newest first. */
export interface FeedEntry {
  id: string;
  kind: "event" | "adjustment";
  createdAt: string;
  managerId: string;
  assetId: string | null;
  matchId: string | null;
  type: FantasyEvent["type"] | "manual_adjustment";
  points: number;
  detail: string | null;
  minute: number | null;
}

export function getEventFeed(data: LeagueData): FeedEntry[] {
  const eventEntries: FeedEntry[] = data.fantasyEvents.map((e) => ({
    id: e.id,
    kind: "event",
    createdAt: e.createdAt,
    managerId: e.managerId,
    assetId: e.assetId,
    matchId: e.matchId,
    type: e.type,
    points: e.points,
    detail: e.detail,
    minute: e.minute,
  }));
  const adjustmentEntries: FeedEntry[] = data.manualAdjustments.map((a) => ({
    id: a.id,
    kind: "adjustment",
    createdAt: a.createdAt,
    managerId: a.managerId,
    assetId: a.assetId,
    matchId: null,
    type: "manual_adjustment",
    points: a.points,
    detail: a.reason,
    minute: null,
  }));
  return [...eventEntries, ...adjustmentEntries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
