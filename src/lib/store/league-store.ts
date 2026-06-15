import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { countryCode } from "@/lib/countries";
import {
  SEED_AUDIT_LOG,
  SEED_FANTASY_EVENTS,
  SEED_MANAGERS,
  SEED_MANUAL_ADJUSTMENTS,
  SEED_MATCHES,
  SEED_SQUAD_ASSETS,
} from "@/lib/data/seed";
import { calculateEventPoints, computeMatchResultEvents, DEFAULT_SCORING_VALUES } from "@/lib/scoring";
import { getAssetPoints, getManagerTotal, type LeagueData } from "@/lib/selectors";
import type {
  AuditAction,
  AuditLogEntry,
  FantasyEvent,
  FantasyEventType,
  Match,
  ManualAdjustment,
  RawApiEvent,
  ScoringValues,
  SquadAsset,
} from "@/lib/types";

export const DEFAULT_ADMIN_ACTOR = "admin";

function generateId(prefix: string): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${prefix}-${random}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

interface AddEventInput {
  matchId: string | null;
  assetId: string;
  type: FantasyEventType;
  minute: number | null;
  detail: string;
}

interface UpdateEventInput {
  matchId?: string | null;
  assetId?: string;
  type?: FantasyEventType;
  minute?: number | null;
  detail?: string;
}

interface AddAdjustmentInput {
  managerId: string;
  assetId: string | null;
  points: number;
  reason: string;
}

export interface LeagueStore extends LeagueData {
  apiEventCache: string[];

  addFantasyEvent: (input: AddEventInput, actor?: string) => void;
  updateFantasyEvent: (id: string, patch: UpdateEventInput, reason: string, actor?: string) => void;
  deleteFantasyEvent: (id: string, reason: string, actor?: string) => void;

  addManualAdjustment: (input: AddAdjustmentInput, actor?: string) => void;
  deleteManualAdjustment: (id: string, reason: string, actor?: string) => void;

  updateScoringValues: (values: ScoringValues, mode: "forward" | "recalculate", actor?: string) => void;
  recalculateAllPoints: (actor?: string) => void;

  toggleMatchLock: (matchId: string, actor?: string) => void;

  /**
   * Manually corrects a match's status/score/minute - for fixtures the
   * live provider doesn't cover yet (or got wrong). If this transitions
   * the match to "completed" for the first time, also computes and
   * ingests its result-based events (clean sheets, team win/loss/3+
   * bonuses), exactly like syncMatches does for live data.
   */
  updateMatchResult: (
    matchId: string,
    patch: Partial<Pick<Match, "status" | "homeScore" | "awayScore" | "minute">>,
    actor?: string,
  ) => void;

  /** Edits a squad asset's mapping (name, country, position, asset type) from the Mapping tab. */
  updateSquadAsset: (
    id: string,
    patch: Partial<Pick<SquadAsset, "name" | "country" | "position" | "assetType">>,
    actor?: string,
  ) => void;

  ingestApiEvents: (events: RawApiEvent[], source: "api" | "mock" | "manual", actor?: string) => number;

  /**
   * Merges fresh status/score/minute for tracked matches from a live
   * provider into the store (skipping locked matches). For any match
   * newly reported as "completed", also computes and ingests its
   * result-based events (clean sheets, team win/loss/3+ bonuses).
   */
  syncMatches: (apiMatches: Match[]) => void;

  resetToSeed: () => void;
}

function describeEvent(event: FantasyEvent): string {
  const minute = event.minute !== null ? `${event.minute}'` : "—";
  return `${event.type} (${minute}, ${event.points >= 0 ? "+" : ""}${event.points} pts)`;
}

function pushAudit(
  log: AuditLogEntry[],
  entry: Omit<AuditLogEntry, "id" | "timestamp">,
): AuditLogEntry[] {
  const full: AuditLogEntry = { ...entry, id: generateId("audit"), timestamp: nowIso() };
  return [full, ...log];
}

const initialState: LeagueData & { apiEventCache: string[] } = {
  managers: SEED_MANAGERS,
  squadAssets: SEED_SQUAD_ASSETS,
  matches: SEED_MATCHES,
  fantasyEvents: SEED_FANTASY_EVENTS,
  manualAdjustments: SEED_MANUAL_ADJUSTMENTS,
  scoringValues: DEFAULT_SCORING_VALUES,
  auditLog: SEED_AUDIT_LOG,
  apiEventCache: [],
};

export const useLeagueStore = create<LeagueStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addFantasyEvent: (input, actor = DEFAULT_ADMIN_ACTOR) => {
        const state = get();
        const asset = state.squadAssets.find((a) => a.id === input.assetId);
        if (!asset) return;
        const points = calculateEventPoints(input.type, asset, state.scoringValues);
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
        const manager = state.managers.find((m) => m.id === asset.managerId);
        const auditLog = pushAudit(state.auditLog, {
          action: "create_event" as AuditAction,
          actor,
          managerId: asset.managerId,
          managerName: manager?.name,
          assetId: asset.id,
          assetName: asset.name,
          oldValue: "—",
          newValue: describeEvent(event),
          reason: "Event added by admin",
        });
        set({ fantasyEvents: [...state.fantasyEvents, event], auditLog });
      },

      updateFantasyEvent: (id, patch, reason, actor = DEFAULT_ADMIN_ACTOR) => {
        const state = get();
        const existing = state.fantasyEvents.find((e) => e.id === id);
        if (!existing) return;

        const nextAssetId = patch.assetId ?? existing.assetId;
        const asset = state.squadAssets.find((a) => a.id === nextAssetId);
        if (!asset) return;

        const nextType = patch.type ?? existing.type;
        const points = calculateEventPoints(nextType, asset, state.scoringValues);

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

        const manager = state.managers.find((m) => m.id === asset.managerId);
        const auditLog = pushAudit(state.auditLog, {
          action: "update_event" as AuditAction,
          actor,
          managerId: asset.managerId,
          managerName: manager?.name,
          assetId: asset.id,
          assetName: asset.name,
          oldValue: describeEvent(existing),
          newValue: describeEvent(updated),
          reason,
        });

        set({
          fantasyEvents: state.fantasyEvents.map((e) => (e.id === id ? updated : e)),
          auditLog,
        });
      },

      deleteFantasyEvent: (id, reason, actor = DEFAULT_ADMIN_ACTOR) => {
        const state = get();
        const existing = state.fantasyEvents.find((e) => e.id === id);
        if (!existing) return;
        const asset = state.squadAssets.find((a) => a.id === existing.assetId);
        const manager = state.managers.find((m) => m.id === existing.managerId);

        const auditLog = pushAudit(state.auditLog, {
          action: "delete_event" as AuditAction,
          actor,
          managerId: existing.managerId,
          managerName: manager?.name,
          assetId: existing.assetId,
          assetName: asset?.name,
          oldValue: describeEvent(existing),
          newValue: "deleted",
          reason,
        });

        set({
          fantasyEvents: state.fantasyEvents.filter((e) => e.id !== id),
          auditLog,
        });
      },

      addManualAdjustment: (input, actor = DEFAULT_ADMIN_ACTOR) => {
        const state = get();
        const manager = state.managers.find((m) => m.id === input.managerId);
        if (!manager) return;
        const asset = input.assetId ? state.squadAssets.find((a) => a.id === input.assetId) : undefined;

        const oldValue = input.assetId ? getAssetPoints(state, input.assetId) : getManagerTotal(state, input.managerId);

        const adjustment: ManualAdjustment = {
          id: generateId("madj"),
          managerId: input.managerId,
          assetId: input.assetId,
          points: input.points,
          reason: input.reason,
          createdAt: nowIso(),
          createdBy: actor,
        };

        const nextState = { ...state, manualAdjustments: [...state.manualAdjustments, adjustment] };
        const newValue = input.assetId ? getAssetPoints(nextState, input.assetId) : getManagerTotal(nextState, input.managerId);

        const auditLog = pushAudit(state.auditLog, {
          action: "manual_adjustment" as AuditAction,
          actor,
          managerId: manager.id,
          managerName: manager.name,
          assetId: asset?.id,
          assetName: asset?.name,
          oldValue: String(oldValue),
          newValue: String(newValue),
          reason: input.reason,
        });

        set({ manualAdjustments: nextState.manualAdjustments, auditLog });
      },

      deleteManualAdjustment: (id, reason, actor = DEFAULT_ADMIN_ACTOR) => {
        const state = get();
        const existing = state.manualAdjustments.find((a) => a.id === id);
        if (!existing) return;

        const manager = state.managers.find((m) => m.id === existing.managerId);
        const asset = existing.assetId ? state.squadAssets.find((a) => a.id === existing.assetId) : undefined;

        const auditLog = pushAudit(state.auditLog, {
          action: "delete_adjustment" as AuditAction,
          actor,
          managerId: existing.managerId,
          managerName: manager?.name,
          assetId: asset?.id,
          assetName: asset?.name,
          oldValue: `${existing.points >= 0 ? "+" : ""}${existing.points} pts (${existing.reason})`,
          newValue: "deleted",
          reason,
        });

        set({
          manualAdjustments: state.manualAdjustments.filter((a) => a.id !== id),
          auditLog,
        });
      },

      updateScoringValues: (values, mode, actor = DEFAULT_ADMIN_ACTOR) => {
        const state = get();
        const oldValue = JSON.stringify(state.scoringValues);
        const newValue = JSON.stringify(values);

        let fantasyEvents = state.fantasyEvents;
        let auditLog = pushAudit(state.auditLog, {
          action: "update_scoring_rules" as AuditAction,
          actor,
          oldValue,
          newValue,
          reason: mode === "recalculate" ? "Scoring values updated; historical events recalculated" : "Scoring values updated for future events only",
        });

        if (mode === "recalculate") {
          const assetsById = new Map(state.squadAssets.map((a) => [a.id, a]));
          fantasyEvents = fantasyEvents.map((event) => {
            const asset = assetsById.get(event.assetId);
            if (!asset) return event;
            return { ...event, points: calculateEventPoints(event.type, asset, values) };
          });
          auditLog = pushAudit(auditLog, {
            action: "recalculate_points" as AuditAction,
            actor,
            oldValue: `${state.fantasyEvents.length} events (previous values)`,
            newValue: `${fantasyEvents.length} events recalculated`,
            reason: "Recalculated after scoring rule change",
          });
        }

        set({ scoringValues: values, fantasyEvents, auditLog });
      },

      recalculateAllPoints: (actor = DEFAULT_ADMIN_ACTOR) => {
        const state = get();
        const assetsById = new Map(state.squadAssets.map((a) => [a.id, a]));
        const fantasyEvents = state.fantasyEvents.map((event) => {
          const asset = assetsById.get(event.assetId);
          if (!asset) return event;
          return { ...event, points: calculateEventPoints(event.type, asset, state.scoringValues) };
        });

        const auditLog = pushAudit(state.auditLog, {
          action: "recalculate_points" as AuditAction,
          actor,
          oldValue: `${state.fantasyEvents.length} events`,
          newValue: "recalculated using current scoring rules",
          reason: "Manual recalculation requested from admin dashboard",
        });

        set({ fantasyEvents, auditLog });
      },

      toggleMatchLock: (matchId, actor = DEFAULT_ADMIN_ACTOR) => {
        const state = get();
        const match = state.matches.find((m) => m.id === matchId);
        if (!match) return;
        const nextLocked = !match.locked;

        const auditLog = pushAudit(state.auditLog, {
          action: (nextLocked ? "lock_match" : "unlock_match") as AuditAction,
          actor,
          assetName: `${match.homeTeam} vs ${match.awayTeam}`,
          oldValue: match.locked ? "locked" : "unlocked",
          newValue: nextLocked ? "locked" : "unlocked",
          reason: nextLocked ? "Marked as reviewed" : "Reopened for corrections",
        });

        set({
          matches: state.matches.map((m) => (m.id === matchId ? { ...m, locked: nextLocked } : m)),
          auditLog,
        });
      },

      updateMatchResult: (matchId, patch, actor = DEFAULT_ADMIN_ACTOR) => {
        const state = get();
        const match = state.matches.find((m) => m.id === matchId);
        if (!match) return;

        const updated: Match = { ...match, ...patch };
        const describeResult = (m: Match) =>
          `${m.status}${m.homeScore !== null && m.awayScore !== null ? ` ${m.homeScore}-${m.awayScore}` : ""}`;

        const auditLog = pushAudit(state.auditLog, {
          action: "update_match" as AuditAction,
          actor,
          assetName: `${match.homeTeam} vs ${match.awayTeam}`,
          oldValue: describeResult(match),
          newValue: describeResult(updated),
          reason: "Match result corrected manually by admin",
        });

        set({
          matches: state.matches.map((m) => (m.id === matchId ? updated : m)),
          auditLog,
        });

        if (match.status !== "completed" && updated.status === "completed") {
          const resultEvents = computeMatchResultEvents(updated, state.squadAssets);
          if (resultEvents.length > 0) get().ingestApiEvents(resultEvents, "manual");
        }
      },

      updateSquadAsset: (id, patch, actor = DEFAULT_ADMIN_ACTOR) => {
        const state = get();
        const existing = state.squadAssets.find((a) => a.id === id);
        if (!existing) return;

        const updated: SquadAsset = {
          ...existing,
          ...patch,
          countryCode: patch.country ? countryCode(patch.country) : existing.countryCode,
        };

        const manager = state.managers.find((m) => m.id === existing.managerId);
        const describeAsset = (a: SquadAsset) => `${a.name} (${a.country}, ${a.position}, ${a.assetType})`;

        const auditLog = pushAudit(state.auditLog, {
          action: "update_squad_asset" as AuditAction,
          actor,
          managerId: existing.managerId,
          managerName: manager?.name,
          assetId: existing.id,
          assetName: updated.name,
          oldValue: describeAsset(existing),
          newValue: describeAsset(updated),
          reason: "Squad mapping corrected by admin",
        });

        set({
          squadAssets: state.squadAssets.map((a) => (a.id === id ? updated : a)),
          auditLog,
        });
      },

      ingestApiEvents: (events, source) => {
        const state = get();
        const knownHashes = new Set(state.apiEventCache);
        const assetsById = new Map(state.squadAssets.map((a) => [a.id, a]));

        const newEvents: FantasyEvent[] = [];
        const newHashes: string[] = [];

        for (const raw of events) {
          const hash = `${raw.fixtureId}:${raw.assetId}:${raw.minute}:${raw.type}:${raw.detail}`;
          if (knownHashes.has(hash) || newHashes.includes(hash)) continue;

          const asset = assetsById.get(raw.assetId);
          if (!asset) continue;

          newHashes.push(hash);
          newEvents.push({
            id: generateId("evt"),
            matchId: raw.fixtureId,
            assetId: raw.assetId,
            managerId: asset.managerId,
            type: raw.type,
            points: calculateEventPoints(raw.type, asset, state.scoringValues),
            minute: raw.minute,
            detail: raw.detail,
            createdAt: nowIso(),
            source,
            eventHash: hash,
          });
        }

        if (newEvents.length === 0) return 0;

        set({
          fantasyEvents: [...state.fantasyEvents, ...newEvents],
          apiEventCache: [...state.apiEventCache, ...newHashes],
        });
        return newEvents.length;
      },

      syncMatches: (apiMatches) => {
        const state = get();
        const apiById = new Map(apiMatches.map((m) => [m.id, m]));
        const existingIds = new Set(state.matches.map((m) => m.id));
        let resultEvents: RawApiEvent[] = [];

        const matches = state.matches.map((match) => {
          if (match.locked) return match;
          const apiMatch = apiById.get(match.id);
          if (!apiMatch) return match;

          const updated: Match = {
            ...match,
            status: apiMatch.status,
            homeScore: apiMatch.homeScore,
            awayScore: apiMatch.awayScore,
            minute: apiMatch.minute,
          };

          if (match.status !== "completed" && updated.status === "completed") {
            resultEvents = [...resultEvents, ...computeMatchResultEvents(updated, state.squadAssets)];
          }

          return updated;
        });

        // Newly-discovered fixtures (e.g. knockout matches the provider finds
        // dynamically) aren't in state.matches yet - append them so they show
        // up in the UI and get synced like any other match from now on.
        const newMatches = apiMatches.filter((m) => !existingIds.has(m.id));
        for (const match of newMatches) {
          if (match.status === "completed") {
            resultEvents = [...resultEvents, ...computeMatchResultEvents(match, state.squadAssets)];
          }
        }

        set({ matches: [...matches, ...newMatches] });
        if (resultEvents.length > 0) {
          get().ingestApiEvents(resultEvents, "api");
        }
      },

      resetToSeed: () => set({ ...initialState }),
    }),
    {
      name: "wc-fantasy-league-v5",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
