import { SEED_MATCHES } from "@/lib/data/seed";
import type { ApiProvider } from "./types";
import type { RawApiEvent } from "@/lib/types";

const LIVE_MATCH_ID = "m13";

// A small "script" of events that trickle in for the live match while the
// app is open, so the live event feed and rank-movement indicators have
// something to react to. Each entry becomes visible `revealAfterMs` after
// the module first loads (i.e. after the page is opened).
const MOCK_LIVE_SCRIPT: { revealAfterMs: number; event: RawApiEvent }[] = [
  {
    revealAfterMs: 60_000,
    event: {
      fixtureId: LIVE_MATCH_ID,
      assetId: "sac-6",
      type: "yellow_card",
      minute: 75,
      detail: "Booked for a tactical foul to stop a Spain counter-attack",
    },
  },
  {
    revealAfterMs: 180_000,
    event: {
      fixtureId: LIVE_MATCH_ID,
      assetId: "sac-2",
      type: "assist",
      minute: 82,
      detail: "Cuts it back for a third Spain goal",
    },
  },
  {
    revealAfterMs: 300_000,
    event: {
      fixtureId: LIVE_MATCH_ID,
      assetId: "sac-4",
      type: "clean_sheet",
      minute: 90,
      detail: "Spain see out a clean sheet",
    },
  },
];

const moduleLoadedAt = Date.now();

export const mockProvider: ApiProvider = {
  async getMatches() {
    return SEED_MATCHES;
  },

  async getLiveEvents(matches) {
    const liveMatchIds = new Set(matches.filter((m) => m.status === "live").map((m) => m.id));
    if (!liveMatchIds.has(LIVE_MATCH_ID)) return [];

    const elapsed = Date.now() - moduleLoadedAt;
    return MOCK_LIVE_SCRIPT.filter((entry) => elapsed >= entry.revealAfterMs).map((entry) => entry.event);
  },
};
