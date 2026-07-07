// Core domain types for the Fantasy World Cup Draft tracker.
// These mirror the Supabase schema in supabase/schema.sql so the
// mocked store and a future Supabase-backed store share shapes.

export type AssetType = "player" | "team";

export type Position = "Goalkeeper" | "Defender" | "Midfielder" | "Striker" | "Team";

export interface Manager {
  id: string;
  name: string;
  initials: string;
  /** Hex accent colour used for avatars, charts and highlights. */
  color: string;
  tagline?: string;
}

export interface SquadAsset {
  id: string;
  managerId: string;
  /** 1-8, position within the manager's squad. */
  slot: number;
  name: string;
  country: string;
  /** ISO-3166 alpha-2 (or special GB-ENG/GB-SCT/GB-WLS) code used for flag emoji. */
  countryCode: string;
  position: Position;
  assetType: AssetType;
  /** Manually flagged by an admin as unavailable (injury, squad omission, etc). */
  unavailable?: boolean;
}

export type MatchStatus = "upcoming" | "live" | "completed";

export interface Match {
  id: string;
  stage: string;
  homeTeam: string;
  homeCountryCode: string;
  awayTeam: string;
  awayCountryCode: string;
  /** ISO date-time string. */
  kickoff: string;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  /** Minutes played, only meaningful while status === "live". */
  minute: number | null;
  /**
   * Which side actually won, when it can't be inferred from the score alone —
   * i.e. a knockout tie level after extra time and decided on penalties. null
   * for an unfinished match or a genuine draw (group stage). Lets result
   * scoring award a shootout winner the team_win their goal tally hides.
   */
  winner?: "home" | "away" | null;
  venue: string;
  /** True once an admin has reviewed/locked this match's events. */
  locked: boolean;
}

export type FantasyEventType =
  | "goal"
  | "assist"
  | "yellow_card"
  | "red_card"
  | "own_goal"
  | "penalty_saved"
  | "penalty_missed"
  | "clean_sheet"
  | "team_win"
  | "team_loss"
  | "team_scored_3plus"
  | "team_conceded_3plus"
  | "manual_adjustment";

export type FantasyEventSource = "seed" | "mock" | "api" | "manual";

export interface FantasyEvent {
  id: string;
  matchId: string | null;
  assetId: string;
  managerId: string;
  type: FantasyEventType;
  /** Points awarded for this event, computed from scoring rules at creation time. */
  points: number;
  minute: number | null;
  detail: string | null;
  createdAt: string;
  source: FantasyEventSource;
  /** Dedup hash: fixtureId + playerId/teamId + minute + eventType + detail. */
  eventHash: string | null;
}

export interface ScoringValues {
  goal: number;
  assist: number;
  cleanSheetDefenderGk: number;
  yellowCard: number;
  redCard: number;
  ownGoal: number;
  missedPenalty: number;
  penaltySaved: number;
  teamWin: number;
  teamLoss: number;
  teamScored3Plus: number;
  teamConceded3Plus: number;
}

export interface ManualAdjustment {
  id: string;
  managerId: string;
  /** Null when the adjustment applies to the manager's total directly. */
  assetId: string | null;
  points: number;
  reason: string;
  createdAt: string;
  createdBy: string;
}

export type AuditAction =
  | "create_event"
  | "update_event"
  | "delete_event"
  | "manual_adjustment"
  | "delete_adjustment"
  | "update_scoring_rules"
  | "recalculate_points"
  | "lock_match"
  | "unlock_match"
  | "update_squad_asset"
  | "update_match";

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  actor: string;
  managerId?: string;
  managerName?: string;
  assetId?: string;
  assetName?: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  timestamp: string;
}

/** Raw event shape returned by an API provider, before mapping to a FantasyEvent. */
export interface RawApiEvent {
  fixtureId: string;
  /** squad_assets.id this raw event maps to. */
  assetId: string;
  type: FantasyEventType;
  minute: number;
  detail: string;
}

export interface ApiEventCacheEntry {
  hash: string;
  fixtureId: string;
  processedAt: string;
}
