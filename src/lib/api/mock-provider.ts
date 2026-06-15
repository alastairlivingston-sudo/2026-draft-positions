import { SEED_MATCHES } from "@/lib/data/seed";
import type { ApiProvider } from "./types";

/**
 * Mock provider for local development - returns the seed schedule as-is
 * and no live events. Real live events for in-progress matches come from
 * src/lib/api/espn-provider.ts once NEXT_PUBLIC_USE_MOCK_DATA=false.
 */
export const mockProvider: ApiProvider = {
  async getMatches() {
    return SEED_MATCHES;
  },

  async getLiveEvents() {
    return [];
  },
};
