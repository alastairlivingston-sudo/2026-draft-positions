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
  /**
   * Match ids whose result-based events (clean sheets, team bonuses)
   * have already been derived, so we compute them exactly once per match
   * - on the transition to "completed", or as a one-time backfill for a
   * match that was already "completed" in persisted state (e.g. synced
   * before a scoring-logic fix). ingestApiEvents still dedupes, so a
   * recompute never double-counts.
   */
  resultComputedMatchIds: string[];

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

  /** Edits a squad asset's mapping (name, country, position, asset type, availability) from the Mapping tab. */
  updateSquadAsset: (
    id: string,
    patch: Partial<Pick<SquadAsset, "name" | "country" | "position" | "assetType" | "unavailable">>,
    actor?: string,
  ) => void;

  ingestApiEvents: (events: RawApiEvent[], source: "api" | "mock" | "manual", actor?: string) => number;

  /**
   * Merges fresh status/score/minute for tracked matches from a live
   * provider into the store (skipping locked matches). For any match
   * newly reported as "completed", also computes and ingests its
   * result-based events (clean sheets, team win/loss/3+ bonuses).
   *
   * `nonAppearingAssetIds` (from EspnProvider.getNonAppearingAssetIds)
   * maps each match id to the squad GK/Defender asset ids that didn't
   * appear in that match at all, so they're excluded from the automatic
   * clean_sheet bonus for that match only. Keyed per-match because a
   * player can sit out one fixture yet start and keep a clean sheet in
   * another - a flat list would wrongly suppress the bonus everywhere.
   */
  syncMatches: (apiMatches: Match[], nonAppearingAssetIds?: Record<string, string[]>) => void;

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

/**
 * Collapses fantasyEvents that represent the same real-world event under
 * the (matchId, assetId, type, minute) key (see ingestApiEvents), keeping
 * the earliest-recorded one. One-time cleanup for browsers whose persisted
 * state already has duplicates from before that dedup check existed (e.g.
 * a curated seed goal re-ingested from a live API re-fetch) - ingestApiEvents
 * itself prevents new duplicates going forward.
 */
export function dedupeFantasyEvents(events: FantasyEvent[]): FantasyEvent[] {
  const bestByKey = new Map<string, FantasyEvent>();
  for (const event of events) {
    // Only events tied to a real match can collide this way - freeform
    // manual events (matchId: null) are intentionally never deduped, since
    // an admin may add several distinct ones for the same asset/type with
    // no minute to disambiguate them.
    if (event.matchId === null) continue;
    const key = `${event.matchId}:${event.assetId}:${event.type}:${event.minute}`;
    const existing = bestByKey.get(key);
    if (!existing || new Date(event.createdAt).getTime() < new Date(existing.createdAt).getTime()) {
      bestByKey.set(key, event);
    }
  }
  const kept = new Set(bestByKey.values());
  return events.filter((event) => event.matchId === null || kept.has(event));
}

const initialState: LeagueData & { apiEventCache: string[]; resultComputedMatchIds: string[] } = {
  managers: SEED_MANAGERS,
  squadAssets: SEED_SQUAD_ASSETS,
  matches: SEED_MATCHES,
  fantasyEvents: SEED_FANTASY_EVENTS,
  manualAdjustments: SEED_MANUAL_ADJUSTMENTS,
  scoringValues: DEFAULT_SCORING_VALUES,
  auditLog: SEED_AUDIT_LOG,
  apiEventCache: [],
  resultComputedMatchIds: [],
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

        let auditLog = pushAudit(state.auditLog, {
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

        // Newly-flagged-unavailable players can't have actually kept a
        // clean sheet - strip any already-recorded clean_sheet bonus for
        // them (mirrors the Joe Gauci correction in the original seed
        // data, generalized to the admin toggle).
        let fantasyEvents = state.fantasyEvents;
        if (patch.unavailable && !existing.unavailable) {
          const stale = fantasyEvents.filter((e) => e.assetId === id && e.type === "clean_sheet");
          if (stale.length > 0) {
            fantasyEvents = fantasyEvents.filter((e) => !stale.includes(e));
            for (const event of stale) {
              auditLog = pushAudit(auditLog, {
                action: "delete_event" as AuditAction,
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

        set({
          squadAssets: state.squadAssets.map((a) => (a.id === id ? updated : a)),
          fantasyEvents,
          auditLog,
        });
      },

      ingestApiEvents: (events, source) => {
        const state = get();
        const knownHashes = new Set(state.apiEventCache);
        const assetsById = new Map(state.squadAssets.map((a) => [a.id, a]));

        // Catches the same real-world event arriving with different exact
        // wording - e.g. a goal already recorded via curated SEED_FANTASY_EVENTS
        // (source "seed", eventHash null, so it never registers in
        // apiEventCache) re-appearing from ESPN's keyEvents feed with its own
        // `detail` text. (matchId, assetId, type, minute) identifies a single
        // real event - even a brace has two distinct minutes - without
        // requiring the detail text to match verbatim.
        const knownEventKeys = new Set(
          state.fantasyEvents.map((e) => `${e.matchId}:${e.assetId}:${e.type}:${e.minute}`),
        );

        const newEvents: FantasyEvent[] = [];
        const newHashes: string[] = [];
        const newEventKeys = new Set<string>();

        for (const raw of events) {
          const hash = `${raw.fixtureId}:${raw.assetId}:${raw.minute}:${raw.type}:${raw.detail}`;
          const eventKey = `${raw.fixtureId}:${raw.assetId}:${raw.type}:${raw.minute}`;
          if (knownHashes.has(hash) || newHashes.includes(hash)) continue;
          if (knownEventKeys.has(eventKey) || newEventKeys.has(eventKey)) continue;

          const asset = assetsById.get(raw.assetId);
          if (!asset) continue;

          newHashes.push(hash);
          newEventKeys.add(eventKey);
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

      syncMatches: (apiMatches, nonAppearingAssetIds) => {
        const state = get();
        const apiById = new Map(apiMatches.map((m) => [m.id, m]));
        const existingIds = new Set(state.matches.map((m) => m.id));
        // Per-match exclusion sets: a player who sat out one fixture must
        // not lose a clean sheet they kept in another, so look these up by
        // the specific match id rather than against one global set.
        const nonPlayingByMatch = nonAppearingAssetIds ?? {};
        const nonPlayingFor = (matchId: string) => new Set(nonPlayingByMatch[matchId] ?? []);

        // Derive result events once per match: on the transition to
        // "completed", or as a one-time backfill for a match that was
        // already "completed" in persisted state but hasn't been computed
        // (e.g. synced before this scoring-logic fix). Locked matches keep
        // their curated/reviewed events untouched.
        const computed = new Set(state.resultComputedMatchIds);
        const newlyComputed: string[] = [];
        let resultEvents: RawApiEvent[] = [];
        const deriveOnce = (match: Match) => {
          if (match.locked || match.status !== "completed" || computed.has(match.id)) return;
          resultEvents = [...resultEvents, ...computeMatchResultEvents(match, state.squadAssets, nonPlayingFor(match.id))];
          newlyComputed.push(match.id);
        };

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

          deriveOnce(updated);
          return updated;
        });

        // Newly-discovered fixtures (e.g. knockout matches the provider finds
        // dynamically) aren't in state.matches yet - append them so they show
        // up in the UI and get synced like any other match from now on.
        const newMatches = apiMatches.filter((m) => !existingIds.has(m.id));
        for (const match of newMatches) {
          deriveOnce(match);
        }

        set({
          matches: [...matches, ...newMatches],
          resultComputedMatchIds: [...state.resultComputedMatchIds, ...newlyComputed],
        });
        if (resultEvents.length > 0) {
          get().ingestApiEvents(resultEvents, "api");
        }
      },

      resetToSeed: () => set({ ...initialState }),
    }),
    {
      name: "wc-fantasy-league-v5",
      storage: createJSONStorage(() => localStorage),
      version: 4,
      migrate: (persistedState, version) => {
        let state = persistedState as LeagueData & {
          apiEventCache: string[];
          resultComputedMatchIds?: string[];
        };
        if (version < 1) {
          state = { ...state, fantasyEvents: dedupeFantasyEvents(state.fantasyEvents) };
        }
        if (version < 2) {
          const seedUnavailability = new Map(SEED_SQUAD_ASSETS.map((a) => [a.id, a.unavailable ?? false]));
          state = {
            ...state,
            squadAssets: state.squadAssets.map((asset) =>
              seedUnavailability.has(asset.id) && asset.unavailable === undefined
                ? { ...asset, unavailable: seedUnavailability.get(asset.id) }
                : asset,
            ),
          };
        }
        if (version < 3) {
          // Players not actually in their country's squad (e.g. Kamal
          // Miller, Joe Gauci) could still have a stale auto-awarded
          // clean_sheet bonus from before the unavailable flag excluded
          // them - the bug computeMatchResultEvents had before this
          // version. Strip those now that the flag is reliably set.
          const unavailableIds = new Set(state.squadAssets.filter((a) => a.unavailable).map((a) => a.id));
          state = {
            ...state,
            fantasyEvents: state.fantasyEvents.filter(
              (e) => !(unavailableIds.has(e.assetId) && e.type === "clean_sheet"),
            ),
          };
        }
        if (version < 4) {
          // Earlier builds applied a single, match-agnostic non-appearing
          // exclusion list across every match, so a GK/Defender who sat
          // out one fixture lost the clean sheet they actually kept in
          // another (e.g. Pedro Porro: absent vs Cape Verde, but started
          // and kept one vs Saudi Arabia). Clearing resultComputedMatchIds
          // makes syncMatches re-derive result events once for each
          // already-completed match using the corrected per-match
          // exclusions; ingestApiEvents dedupes, so existing correct
          // events are untouched and only the missing ones are added.
          state = { ...state, resultComputedMatchIds: [] };
        }
        return state;
      },
    },
  ),
);
