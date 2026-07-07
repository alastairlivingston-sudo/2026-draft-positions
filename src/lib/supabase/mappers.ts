// Converts between the snake_case rows in supabase/schema.sql and the
// camelCase domain types in src/lib/types.ts, which the scoring engine,
// selectors and (currently) the Zustand store all share.

import type {
  AuditLogEntry,
  FantasyEvent,
  Manager,
  ManualAdjustment,
  Match,
  ScoringValues,
  SquadAsset,
} from "@/lib/types";

import type { Database } from "./database.types";

type ManagerRow = Database["public"]["Tables"]["managers"]["Row"];
type SquadAssetRow = Database["public"]["Tables"]["squad_assets"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type ScoringRulesRow = Database["public"]["Tables"]["scoring_rules"]["Row"];
type FantasyEventRow = Database["public"]["Tables"]["fantasy_events"]["Row"];
type ManualAdjustmentRow = Database["public"]["Tables"]["manual_adjustments"]["Row"];
type AuditLogRow = Database["public"]["Tables"]["audit_log"]["Row"];

export function managerFromRow(row: ManagerRow): Manager {
  return { id: row.id, name: row.name, initials: row.initials, color: row.color, tagline: row.tagline ?? undefined };
}

export function managerToRow(manager: Manager): Database["public"]["Tables"]["managers"]["Insert"] {
  return { id: manager.id, name: manager.name, initials: manager.initials, color: manager.color, tagline: manager.tagline ?? null };
}

export function squadAssetFromRow(row: SquadAssetRow): SquadAsset {
  return {
    id: row.id,
    managerId: row.manager_id,
    slot: row.slot,
    name: row.name,
    country: row.country,
    countryCode: row.country_code,
    position: row.position as SquadAsset["position"],
    assetType: row.asset_type as SquadAsset["assetType"],
    unavailable: row.unavailable ?? undefined,
  };
}

export function squadAssetToRow(asset: SquadAsset): Database["public"]["Tables"]["squad_assets"]["Insert"] {
  return {
    id: asset.id,
    manager_id: asset.managerId,
    slot: asset.slot,
    name: asset.name,
    country: asset.country,
    country_code: asset.countryCode,
    position: asset.position,
    asset_type: asset.assetType,
    unavailable: asset.unavailable ?? false,
  };
}

export function matchFromRow(row: MatchRow): Match {
  return {
    id: row.id,
    stage: row.stage,
    homeTeam: row.home_team,
    homeCountryCode: row.home_country_code,
    awayTeam: row.away_team,
    awayCountryCode: row.away_country_code,
    kickoff: row.kickoff,
    status: row.status as Match["status"],
    homeScore: row.home_score,
    awayScore: row.away_score,
    minute: row.minute,
    winner: (row.winner as Match["winner"]) ?? null,
    venue: row.venue,
    locked: row.locked,
  };
}

export function matchToRow(match: Match): Database["public"]["Tables"]["matches"]["Insert"] {
  return {
    id: match.id,
    stage: match.stage,
    home_team: match.homeTeam,
    home_country_code: match.homeCountryCode,
    away_team: match.awayTeam,
    away_country_code: match.awayCountryCode,
    kickoff: match.kickoff,
    status: match.status,
    home_score: match.homeScore,
    away_score: match.awayScore,
    minute: match.minute,
    winner: match.winner ?? null,
    venue: match.venue,
    locked: match.locked,
  };
}

export function scoringValuesFromRow(row: ScoringRulesRow): ScoringValues {
  return {
    goal: row.goal,
    assist: row.assist,
    cleanSheetDefenderGk: row.clean_sheet_defender_gk,
    yellowCard: row.yellow_card,
    redCard: row.red_card,
    ownGoal: row.own_goal,
    missedPenalty: row.missed_penalty,
    penaltySaved: row.penalty_saved,
    teamWin: row.team_win,
    teamLoss: row.team_loss,
    teamScored3Plus: row.team_scored_3plus,
    teamConceded3Plus: row.team_conceded_3plus,
  };
}

export function scoringValuesToRow(values: ScoringValues): Database["public"]["Tables"]["scoring_rules"]["Insert"] {
  return {
    id: 1,
    goal: values.goal,
    assist: values.assist,
    clean_sheet_defender_gk: values.cleanSheetDefenderGk,
    yellow_card: values.yellowCard,
    red_card: values.redCard,
    own_goal: values.ownGoal,
    missed_penalty: values.missedPenalty,
    penalty_saved: values.penaltySaved,
    team_win: values.teamWin,
    team_loss: values.teamLoss,
    team_scored_3plus: values.teamScored3Plus,
    team_conceded_3plus: values.teamConceded3Plus,
  };
}

export function fantasyEventFromRow(row: FantasyEventRow): FantasyEvent {
  return {
    id: row.id,
    matchId: row.match_id,
    assetId: row.asset_id,
    managerId: row.manager_id,
    type: row.type as FantasyEvent["type"],
    points: row.points,
    minute: row.minute,
    detail: row.detail,
    createdAt: row.created_at,
    source: row.source as FantasyEvent["source"],
    eventHash: row.event_hash,
  };
}

export function fantasyEventToRow(event: FantasyEvent): Database["public"]["Tables"]["fantasy_events"]["Insert"] {
  return {
    id: event.id,
    match_id: event.matchId,
    asset_id: event.assetId,
    manager_id: event.managerId,
    type: event.type,
    points: event.points,
    minute: event.minute,
    detail: event.detail,
    created_at: event.createdAt,
    source: event.source,
    event_hash: event.eventHash,
  };
}

export function manualAdjustmentFromRow(row: ManualAdjustmentRow): ManualAdjustment {
  return {
    id: row.id,
    managerId: row.manager_id,
    assetId: row.asset_id,
    points: row.points,
    reason: row.reason,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

export function manualAdjustmentToRow(adjustment: ManualAdjustment): Database["public"]["Tables"]["manual_adjustments"]["Insert"] {
  return {
    id: adjustment.id,
    manager_id: adjustment.managerId,
    asset_id: adjustment.assetId,
    points: adjustment.points,
    reason: adjustment.reason,
    created_at: adjustment.createdAt,
    created_by: adjustment.createdBy,
  };
}

export function auditLogEntryFromRow(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    action: row.action as AuditLogEntry["action"],
    actor: row.actor,
    managerId: row.manager_id ?? undefined,
    managerName: row.manager_name ?? undefined,
    assetId: row.asset_id ?? undefined,
    assetName: row.asset_name ?? undefined,
    oldValue: row.old_value ?? undefined,
    newValue: row.new_value ?? undefined,
    reason: row.reason ?? undefined,
    timestamp: row.timestamp,
  };
}

export function auditLogEntryToRow(entry: AuditLogEntry): Database["public"]["Tables"]["audit_log"]["Insert"] {
  return {
    id: entry.id,
    action: entry.action,
    actor: entry.actor,
    manager_id: entry.managerId ?? null,
    manager_name: entry.managerName ?? null,
    asset_id: entry.assetId ?? null,
    asset_name: entry.assetName ?? null,
    old_value: entry.oldValue ?? null,
    new_value: entry.newValue ?? null,
    reason: entry.reason ?? null,
    timestamp: entry.timestamp,
  };
}
