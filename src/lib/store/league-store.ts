import { create } from "zustand";

import {
  SEED_AUDIT_LOG,
  SEED_FANTASY_EVENTS,
  SEED_MANAGERS,
  SEED_MANUAL_ADJUSTMENTS,
  SEED_MATCHES,
  SEED_SQUAD_ASSETS,
} from "@/lib/data/seed";
import { DEFAULT_SCORING_VALUES } from "@/lib/scoring";
import type { LeagueData } from "@/lib/selectors";

export interface LeagueStore extends LeagueData {
  /**
   * Replaces the whole store wholesale with a Supabase snapshot (see
   * /api/league-snapshot and useSupabaseSnapshotPolling) - Supabase is the
   * single source of truth, so every poll is a full replace rather than a
   * merge. Admin writes go through /api/admin/mutate
   * (src/lib/store/mutations.ts) instead of store actions; this store is
   * purely a read-side cache that every page subscribes to.
   */
  hydrateFromSnapshot: (data: LeagueData) => void;
}

/**
 * Placeholder initial state shown for the brief window before the first
 * snapshot poll resolves - not persisted anywhere (no localStorage; see
 * docs/supabase-migration.md Phase 4), just seed data so pages have
 * something reasonable to render immediately on load.
 */
const initialState: LeagueData = {
  managers: SEED_MANAGERS,
  squadAssets: SEED_SQUAD_ASSETS,
  matches: SEED_MATCHES,
  fantasyEvents: SEED_FANTASY_EVENTS,
  manualAdjustments: SEED_MANUAL_ADJUSTMENTS,
  scoringValues: DEFAULT_SCORING_VALUES,
  auditLog: SEED_AUDIT_LOG,
};

export const useLeagueStore = create<LeagueStore>()((set) => ({
  ...initialState,
  hydrateFromSnapshot: (data) => set(data),
}));
