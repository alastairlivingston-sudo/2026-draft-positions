import { countryCode } from "@/lib/countries";
import { calculateEventPoints, computeMatchResultEvents, materializeFantasyEvents, RESULT_EVENT_TYPES } from "@/lib/scoring";
import { getAssetPoints, getManagerTotal, type LeagueData } from "@/lib/selectors";
import type {
  AuditLogEntry,
  FantasyEvent,
  FantasyEventType,
  Match,
  ManualAdjustment,
  ScoringValues,
  SquadAsset,
} from "@/lib/types";

export const DEFAULT_ADMIN_ACTOR = "admin";

export interface AddEventInput {
  matchId: string | null;
  assetId: string;
  type: FantasyEventType;
  minute: number | null;
  detail: string;
}

export interface UpdateEventInput {
  matchId?: string | null;
  assetId?: string;
  type?: FantasyEventType;
  minute?: number | null;
  detail?: string;
}

export interface AddAdjustmentInput {
  managerId: string;
  assetId: string | null;
  points: number;
  reason: string;
}

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function describeEvent(event: FantasyEvent): string {
  const minute = event.minute !== null ? `${event.minute}'` : "—";
  return `${event.type} (${minute}, ${event.points >= 0 ? "+" : ""}${event.points} pts)`;
}

function pushAudit(log: AuditLogEntry[], entry: Omit<AuditLogEntry, "id" | "timestamp">): AuditLogEntry[] {
  return [{ ...entry, id: generateId("audit"), timestamp: nowIso() }, ...log];
}

/**
 * Server-side equivalents of the Zustand store's admin actions
 * (src/lib/store/league-store.ts), operating on a plain LeagueData
 * snapshot and returning the updated snapshot (or null for a no-op, e.g.
 * an id that doesn't exist) instead of using Zustand get()/set(). Used by
 * the Supabase-backed admin mutate route (src/lib/server/admin-mutations.ts)
 * so a write applies the exact same business logic as the localStorage
 * store. Kept as a parallel implementation rather than a shared refactor
 * of league-store.ts, to avoid any risk of changing that well-tested
 * existing store behavior - the one deliberate difference is
 * applyUpdateMatchResult, which materializes result events directly
 * instead of going through the store's apiEventCache-based ingestApiEvents,
 * since Supabase dedup is enforced by the `event_hash` unique constraint
 * instead (see docs/supabase-migration.md Phase 1).
 */

export function applyAddFantasyEvent(data: LeagueData, input: AddEventInput, actor: string): LeagueData | null {
  const asset = data.squadAssets.find((a) => a.id === input.assetId);
  if (!asset) return null;
  const points = calculateEventPoints(input.type, asset, data.scoringValues);
  const event: FantasyEvent = {
    id: generateId("evt"),
    matchId: input.matchId,
    assetId: input.assetId,
    managerId: asset.managerId,
    type: input.type,
    points,
    minute: input.minute,
    detail: input.detail || null,
    createdAt: nowIso(),
    source: "manual",
    eventHash: null,
  };
  const manager = data.managers.find((m) => m.id === asset.managerId);
  const auditLog = pushAudit(data.auditLog, {
    action: "create_event",
    actor,
    managerId: asset.managerId,
    managerName: manager?.name,
    assetId: asset.id,
    assetName: asset.name,
    oldValue: "—",
    newValue: describeEvent(event),
    reason: "Event added by admin",
  });
  return { ...data, fantasyEvents: [...data.fantasyEvents, event], auditLog };
}

export function applyUpdateFantasyEvent(
  data: LeagueData,
  id: string,
  patch: UpdateEventInput,
  reason: string,
  actor: string,
): LeagueData | null {
  const existing = data.fantasyEvents.find((e) => e.id === id);
  if (!existing) return null;
  const nextAssetId = patch.assetId ?? existing.assetId;
  const asset = data.squadAssets.find((a) => a.id === nextAssetId);
  if (!asset) return null;
  const nextType = patch.type ?? existing.type;
  const points = calculateEventPoints(nextType, asset, data.scoringValues);
  const updated: FantasyEvent = {
    ...existing,
    matchId: patch.matchId ?? existing.matchId,
    assetId: nextAssetId,
    managerId: asset.managerId,
    type: nextType,
    minute: patch.minute ?? existing.minute,
    detail: patch.detail ?? existing.detail,
    points,
  };
  const manager = data.managers.find((m) => m.id === asset.managerId);
  const auditLog = pushAudit(data.auditLog, {
    action: "update_event",
    actor,
    managerId: asset.managerId,
    managerName: manager?.name,
    assetId: asset.id,
    assetName: asset.name,
    oldValue: describeEvent(existing),
    newValue: describeEvent(updated),
    reason,
  });
  return { ...data, fantasyEvents: data.fantasyEvents.map((e) => (e.id === id ? updated : e)), auditLog };
}

export function applyDeleteFantasyEvent(data: LeagueData, id: string, reason: string, actor: string): LeagueData | null {
  const existing = data.fantasyEvents.find((e) => e.id === id);
  if (!existing) return null;
  const asset = data.squadAssets.find((a) => a.id === existing.assetId);
  const manager = data.managers.find((m) => m.id === existing.managerId);
  const auditLog = pushAudit(data.auditLog, {
    action: "delete_event",
    actor,
    managerId: existing.managerId,
    managerName: manager?.name,
    assetId: existing.assetId,
    assetName: asset?.name,
    oldValue: describeEvent(existing),
    newValue: "deleted",
    reason,
  });
  return { ...data, fantasyEvents: data.fantasyEvents.filter((e) => e.id !== id), auditLog };
}

export function applyAddManualAdjustment(data: LeagueData, input: AddAdjustmentInput, actor: string): LeagueData | null {
  const manager = data.managers.find((m) => m.id === input.managerId);
  if (!manager) return null;
  const asset = input.assetId ? data.squadAssets.find((a) => a.id === input.assetId) : undefined;
  const oldValue = input.assetId ? getAssetPoints(data, input.assetId) : getManagerTotal(data, input.managerId);
  const adjustment: ManualAdjustment = {
    id: generateId("madj"),
    managerId: input.managerId,
    assetId: input.assetId,
    points: input.points,
    reason: input.reason,
    createdAt: nowIso(),
    createdBy: actor,
  };
  const nextData = { ...data, manualAdjustments: [...data.manualAdjustments, adjustment] };
  const newValue = input.assetId ? getAssetPoints(nextData, input.assetId) : getManagerTotal(nextData, input.managerId);
  const auditLog = pushAudit(data.auditLog, {
    action: "manual_adjustment",
    actor,
    managerId: manager.id,
    managerName: manager.name,
    assetId: asset?.id,
    assetName: asset?.name,
    oldValue: String(oldValue),
    newValue: String(newValue),
    reason: input.reason,
  });
  return { ...nextData, auditLog };
}

export function applyDeleteManualAdjustment(data: LeagueData, id: string, reason: string, actor: string): LeagueData | null {
  const existing = data.manualAdjustments.find((a) => a.id === id);
  if (!existing) return null;
  const manager = data.managers.find((m) => m.id === existing.managerId);
  const asset = existing.assetId ? data.squadAssets.find((a) => a.id === existing.assetId) : undefined;
  const auditLog = pushAudit(data.auditLog, {
    action: "delete_adjustment",
    actor,
    managerId: existing.managerId,
    managerName: manager?.name,
    assetId: asset?.id,
    assetName: asset?.name,
    oldValue: `${existing.points >= 0 ? "+" : ""}${existing.points} pts (${existing.reason})`,
    newValue: "deleted",
    reason,
  });
  return { ...data, manualAdjustments: data.manualAdjustments.filter((a) => a.id !== id), auditLog };
}

export function applyUpdateScoringValues(
  data: LeagueData,
  values: ScoringValues,
  mode: "forward" | "recalculate",
  actor: string,
): LeagueData {
  const oldValue = JSON.stringify(data.scoringValues);
  const newValue = JSON.stringify(values);
  let fantasyEvents = data.fantasyEvents;
  let auditLog = pushAudit(data.auditLog, {
    action: "update_scoring_rules",
    actor,
    oldValue,
    newValue,
    reason:
      mode === "recalculate" ? "Scoring values updated; historical events recalculated" : "Scoring values updated for future events only",
  });

  if (mode === "recalculate") {
    const assetsById = new Map(data.squadAssets.map((a) => [a.id, a]));
    fantasyEvents = fantasyEvents.map((event) => {
      const asset = assetsById.get(event.assetId);
      if (!asset) return event;
      return { ...event, points: calculateEventPoints(event.type, asset, values) };
    });
    auditLog = pushAudit(auditLog, {
      action: "recalculate_points",
      actor,
      oldValue: `${data.fantasyEvents.length} events (previous values)`,
      newValue: `${fantasyEvents.length} events recalculated`,
      reason: "Recalculated after scoring rule change",
    });
  }

  return { ...data, scoringValues: values, fantasyEvents, auditLog };
}

export function applyRecalculateAllPoints(data: LeagueData, actor: string): LeagueData {
  const assetsById = new Map(data.squadAssets.map((a) => [a.id, a]));
  const fantasyEvents = data.fantasyEvents.map((event) => {
    const asset = assetsById.get(event.assetId);
    if (!asset) return event;
    return { ...event, points: calculateEventPoints(event.type, asset, data.scoringValues) };
  });
  const auditLog = pushAudit(data.auditLog, {
    action: "recalculate_points",
    actor,
    oldValue: `${data.fantasyEvents.length} events`,
    newValue: "recalculated using current scoring rules",
    reason: "Manual recalculation requested from admin dashboard",
  });
  return { ...data, fantasyEvents, auditLog };
}

export function applyToggleMatchLock(data: LeagueData, matchId: string, actor: string): LeagueData | null {
  const match = data.matches.find((m) => m.id === matchId);
  if (!match) return null;
  const nextLocked = !match.locked;
  const auditLog = pushAudit(data.auditLog, {
    action: nextLocked ? "lock_match" : "unlock_match",
    actor,
    assetName: `${match.homeTeam} vs ${match.awayTeam}`,
    oldValue: match.locked ? "locked" : "unlocked",
    newValue: nextLocked ? "locked" : "unlocked",
    reason: nextLocked ? "Marked as reviewed" : "Reopened for corrections",
  });
  return { ...data, matches: data.matches.map((m) => (m.id === matchId ? { ...m, locked: nextLocked } : m)), auditLog };
}

export function applyUpdateMatchResult(
  data: LeagueData,
  matchId: string,
  patch: Partial<Pick<Match, "status" | "homeScore" | "awayScore" | "minute">>,
  actor: string,
): LeagueData | null {
  const match = data.matches.find((m) => m.id === matchId);
  if (!match) return null;

  const updated: Match = { ...match, ...patch };
  const describeResult = (m: Match) =>
    `${m.status}${m.homeScore !== null && m.awayScore !== null ? ` ${m.homeScore}-${m.awayScore}` : ""}`;

  const auditLog = pushAudit(data.auditLog, {
    action: "update_match",
    actor,
    assetName: `${match.homeTeam} vs ${match.awayTeam}`,
    oldValue: describeResult(match),
    newValue: describeResult(updated),
    reason: "Match result corrected manually by admin",
  });

  const isStaleResultEvent = (e: FantasyEvent) => e.matchId === matchId && e.source !== "seed" && RESULT_EVENT_TYPES.includes(e.type);
  let fantasyEvents = updated.status === "completed" ? data.fantasyEvents.filter((e) => !isStaleResultEvent(e)) : data.fantasyEvents;

  if (updated.status === "completed") {
    const rawResultEvents = computeMatchResultEvents(updated, data.squadAssets);
    if (rawResultEvents.length > 0) {
      const assetsById = new Map(data.squadAssets.map((a) => [a.id, a]));
      fantasyEvents = [...fantasyEvents, ...materializeFantasyEvents(rawResultEvents, assetsById, data.scoringValues, "manual")];
    }
  }

  return { ...data, matches: data.matches.map((m) => (m.id === matchId ? updated : m)), fantasyEvents, auditLog };
}

export function applyUpdateSquadAsset(
  data: LeagueData,
  id: string,
  patch: Partial<Pick<SquadAsset, "name" | "country" | "position" | "assetType" | "unavailable">>,
  actor: string,
): LeagueData | null {
  const existing = data.squadAssets.find((a) => a.id === id);
  if (!existing) return null;

  const updated: SquadAsset = { ...existing, ...patch, countryCode: patch.country ? countryCode(patch.country) : existing.countryCode };
  const manager = data.managers.find((m) => m.id === existing.managerId);
  const describeAsset = (a: SquadAsset) => `${a.name} (${a.country}, ${a.position}, ${a.assetType})`;

  let auditLog = pushAudit(data.auditLog, {
    action: "update_squad_asset",
    actor,
    managerId: existing.managerId,
    managerName: manager?.name,
    assetId: existing.id,
    assetName: updated.name,
    oldValue: describeAsset(existing),
    newValue: describeAsset(updated),
    reason: "Squad mapping corrected by admin",
  });

  let fantasyEvents = data.fantasyEvents;
  if (patch.unavailable && !existing.unavailable) {
    const stale = fantasyEvents.filter((e) => e.assetId === id && e.type === "clean_sheet");
    if (stale.length > 0) {
      fantasyEvents = fantasyEvents.filter((e) => !stale.includes(e));
      for (const event of stale) {
        auditLog = pushAudit(auditLog, {
          action: "delete_event",
          actor,
          managerId: existing.managerId,
          managerName: manager?.name,
          assetId: existing.id,
          assetName: updated.name,
          oldValue: `clean_sheet (${event.minute ?? "?"}', +${event.points} pts)`,
          newValue: "deleted",
          reason: `${updated.name} flagged unavailable - not actually in the squad, so earns no points`,
        });
      }
    }
  }

  return { ...data, squadAssets: data.squadAssets.map((a) => (a.id === id ? updated : a)), fantasyEvents, auditLog };
}

/**
 * Discriminated union covering every admin action, so a single RPC-style
 * route (/api/admin/mutate) can dispatch to the right apply* function
 * without a route per action. args mirrors each action's own parameter
 * list (see useLeagueActions, the client-side caller).
 */
export type AdminActionRequest =
  | { action: "addFantasyEvent"; args: [AddEventInput] }
  | { action: "updateFantasyEvent"; args: [string, UpdateEventInput, string] }
  | { action: "deleteFantasyEvent"; args: [string, string] }
  | { action: "addManualAdjustment"; args: [AddAdjustmentInput] }
  | { action: "deleteManualAdjustment"; args: [string, string] }
  | { action: "updateScoringValues"; args: [ScoringValues, "forward" | "recalculate"] }
  | { action: "recalculateAllPoints"; args: [] }
  | { action: "toggleMatchLock"; args: [string] }
  | { action: "updateMatchResult"; args: [string, Partial<Pick<Match, "status" | "homeScore" | "awayScore" | "minute">>] }
  | {
      action: "updateSquadAsset";
      args: [string, Partial<Pick<SquadAsset, "name" | "country" | "position" | "assetType" | "unavailable">>];
    };

export function applyAdminAction(data: LeagueData, request: AdminActionRequest, actor: string): LeagueData | null {
  switch (request.action) {
    case "addFantasyEvent":
      return applyAddFantasyEvent(data, request.args[0], actor);
    case "updateFantasyEvent":
      return applyUpdateFantasyEvent(data, request.args[0], request.args[1], request.args[2], actor);
    case "deleteFantasyEvent":
      return applyDeleteFantasyEvent(data, request.args[0], request.args[1], actor);
    case "addManualAdjustment":
      return applyAddManualAdjustment(data, request.args[0], actor);
    case "deleteManualAdjustment":
      return applyDeleteManualAdjustment(data, request.args[0], request.args[1], actor);
    case "updateScoringValues":
      return applyUpdateScoringValues(data, request.args[0], request.args[1], actor);
    case "recalculateAllPoints":
      return applyRecalculateAllPoints(data, actor);
    case "toggleMatchLock":
      return applyToggleMatchLock(data, request.args[0], actor);
    case "updateMatchResult":
      return applyUpdateMatchResult(data, request.args[0], request.args[1], actor);
    case "updateSquadAsset":
      return applyUpdateSquadAsset(data, request.args[0], request.args[1], actor);
  }
}
