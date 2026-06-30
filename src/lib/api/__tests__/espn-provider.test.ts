import { afterEach, describe, expect, it, vi } from "vitest";

import {
  discoverDynamicMatches,
  EspnProvider,
  findCleanSheetIneligibleAssetIds,
  resolveSquadCountry,
  type EspnEvent,
  type EspnSummaryResponse,
} from "@/lib/api/espn-provider";
import { ESPN_FIXTURE_ID_MAP } from "@/lib/data/espn-fixture-map";
import { SEED_MATCHES } from "@/lib/data/seed";
import type { Match } from "@/lib/types";

function makeEvent(overrides: Partial<EspnEvent> & { id: string }): EspnEvent {
  return {
    date: "2026-06-29T17:00Z",
    competitions: [
      {
        status: { clock: 0, type: { state: "pre" } },
        competitors: [
          { homeAway: "home", team: { displayName: "Group C Winner" } },
          { homeAway: "away", team: { displayName: "Group F 2nd Place" } },
        ],
      },
    ],
    ...overrides,
  };
}

describe("resolveSquadCountry", () => {
  it("matches a squad country name exactly", () => {
    expect(resolveSquadCountry("Argentina")).toBe("Argentina");
  });

  it("resolves known ESPN naming differences via aliases", () => {
    expect(resolveSquadCountry("South Korea")).toBe("Korea");
    expect(resolveSquadCountry("United States")).toBe("USA");
    expect(resolveSquadCountry("Turkey")).toBe("Türkiye");
  });

  it("strips diacritics when matching", () => {
    expect(resolveSquadCountry("Curaçao")).toBe("Curacao");
  });

  it("returns undefined for bracket placeholders and non-squad countries", () => {
    expect(resolveSquadCountry("Group C Winner")).toBeUndefined();
    expect(resolveSquadCountry("Peru")).toBeUndefined();
    expect(resolveSquadCountry(undefined)).toBeUndefined();
  });
});

describe("discoverDynamicMatches", () => {
  it("skips fixtures already covered by ESPN_FIXTURE_ID_MAP", () => {
    const knownEspnId = ESPN_FIXTURE_ID_MAP.m1;
    const event = makeEvent({
      id: String(knownEspnId),
      competitions: [
        {
          status: { clock: 0, type: { state: "pre" } },
          competitors: [
            { homeAway: "home", team: { displayName: "Argentina" } },
            { homeAway: "away", team: { displayName: "South Korea" } },
          ],
        },
      ],
    });

    expect(discoverDynamicMatches([event])).toEqual([]);
  });

  it("skips fixtures where neither side is squad-relevant", () => {
    const event = makeEvent({ id: "999001" });
    expect(discoverDynamicMatches([event])).toEqual([]);
  });

  it("adds a fixture where both sides resolve to squad countries", () => {
    const event = makeEvent({
      id: "999002",
      date: "2026-06-30T17:00Z",
      season: { slug: "round-of-32" },
      competitions: [
        {
          status: { clock: 0, type: { state: "pre" } },
          competitors: [
            { homeAway: "home", team: { displayName: "Argentina" } },
            { homeAway: "away", team: { displayName: "South Korea" } },
          ],
          venue: { fullName: "Test Stadium" },
        },
      ],
    });

    const [match] = discoverDynamicMatches([event]);
    expect(match).toMatchObject({
      id: "espn-999002",
      stage: "Round of 32",
      homeTeam: "Argentina",
      homeCountryCode: "AR",
      awayTeam: "Korea",
      awayCountryCode: "KR",
      kickoff: "2026-06-30T17:00Z",
      status: "upcoming",
      homeScore: null,
      awayScore: null,
      minute: null,
      venue: "Test Stadium",
      locked: false,
    });
  });

  it("adds a fixture where only one side is squad-relevant, falling back to the raw ESPN name for the other", () => {
    const event = makeEvent({
      id: "999003",
      competitions: [
        {
          status: { clock: 0, type: { state: "post" } },
          competitors: [
            { homeAway: "home", team: { displayName: "England" }, score: "2" },
            { homeAway: "away", team: { displayName: "Peru" }, score: "1" },
          ],
        },
      ],
    });

    const [match] = discoverDynamicMatches([event]);
    expect(match.homeTeam).toBe("England");
    expect(match.awayTeam).toBe("Peru");
    expect(match.awayCountryCode).toBe("XX");
    expect(match.status).toBe("completed");
    expect(match.homeScore).toBe(2);
    expect(match.awayScore).toBe(1);
  });

  it("falls back to a generic 'Knockout Stage' label when season.slug is missing", () => {
    const event = makeEvent({
      id: "999004",
      competitions: [
        {
          status: { clock: 0, type: { state: "pre" } },
          competitors: [
            { homeAway: "home", team: { displayName: "Argentina" } },
            { homeAway: "away", team: { displayName: "Group F 2nd Place" } },
          ],
        },
      ],
    });

    const [match] = discoverDynamicMatches([event]);
    expect(match.stage).toBe("Knockout Stage");
  });
});

describe("findCleanSheetIneligibleAssetIds", () => {
  // m13: Spain vs Cape Verde - Spain's only squad GK/Defender is Pedro Porro (sac-4).
  const m13 = SEED_MATCHES.find((m) => m.id === "m13")!;
  const completedDraw: Match = { ...m13, status: "completed", homeScore: 0, awayScore: 0, minute: 90 };

  function summaryWithSpainRoster(roster: EspnSummaryResponse["rosters"]): EspnSummaryResponse {
    return { rosters: roster };
  }

  it("excludes a squad GK/Defender who never started or came on as a sub", () => {
    const json = summaryWithSpainRoster([
      {
        homeAway: "home",
        roster: [
          { starter: true, subbedIn: false, athlete: { displayName: "Unai Simon" } },
          { starter: false, subbedIn: false, athlete: { displayName: "Pedro Porro" } },
        ],
      },
    ]);

    expect(findCleanSheetIneligibleAssetIds(json, completedDraw)).toEqual(["sac-4"]);
  });

  it("does not exclude a squad GK/Defender who started", () => {
    const json = summaryWithSpainRoster([
      {
        homeAway: "home",
        roster: [{ starter: true, subbedIn: false, athlete: { displayName: "Pedro Porro" } }],
      },
    ]);

    expect(findCleanSheetIneligibleAssetIds(json, completedDraw)).toEqual([]);
  });

  it("does not exclude a squad GK/Defender who came on as a substitute", () => {
    const json = summaryWithSpainRoster([
      {
        homeAway: "home",
        roster: [{ starter: false, subbedIn: true, athlete: { displayName: "Pedro Porro" } }],
      },
    ]);

    expect(findCleanSheetIneligibleAssetIds(json, completedDraw)).toEqual([]);
  });

  it("returns nothing for a match with no result yet", () => {
    const upcoming: Match = { ...m13, status: "upcoming", homeScore: null, awayScore: null, minute: null };
    const json = summaryWithSpainRoster([
      {
        homeAway: "home",
        roster: [{ starter: false, subbedIn: false, athlete: { displayName: "Pedro Porro" } }],
      },
    ]);

    expect(findCleanSheetIneligibleAssetIds(json, upcoming)).toEqual([]);
  });

  it("returns nothing when the side conceded a goal", () => {
    const homeConceded: Match = { ...m13, status: "completed", homeScore: 0, awayScore: 1, minute: 90 };
    const json = summaryWithSpainRoster([
      {
        homeAway: "home",
        roster: [{ starter: false, subbedIn: false, athlete: { displayName: "Pedro Porro" } }],
      },
    ]);

    expect(findCleanSheetIneligibleAssetIds(json, homeConceded)).toEqual([]);
  });

  it("excludes a substitute who came on too late to reach 60 minutes", () => {
    const json: EspnSummaryResponse = {
      rosters: [
        {
          homeAway: "home",
          roster: [{ starter: false, subbedIn: true, athlete: { displayName: "Pedro Porro" } }],
        },
      ],
      keyEvents: [
        {
          type: { type: "substitution" },
          clock: { displayValue: "78'" },
          participants: [{ athlete: { displayName: "Pedro Porro" } }, { athlete: { displayName: "Someone Else" } }],
        },
      ],
    };

    expect(findCleanSheetIneligibleAssetIds(json, completedDraw)).toEqual(["sac-4"]);
  });

  it("does not exclude a substitute who came on early enough to reach 60 minutes", () => {
    const json: EspnSummaryResponse = {
      rosters: [
        {
          homeAway: "home",
          roster: [{ starter: false, subbedIn: true, athlete: { displayName: "Pedro Porro" } }],
        },
      ],
      keyEvents: [
        {
          type: { type: "substitution" },
          clock: { displayValue: "20'" },
          participants: [{ athlete: { displayName: "Pedro Porro" } }, { athlete: { displayName: "Someone Else" } }],
        },
      ],
    };

    expect(findCleanSheetIneligibleAssetIds(json, completedDraw)).toEqual([]);
  });

  it("excludes a starter who was subbed off before 60 minutes", () => {
    const json: EspnSummaryResponse = {
      rosters: [
        {
          homeAway: "home",
          roster: [{ starter: true, subbedIn: false, athlete: { displayName: "Pedro Porro" } }],
        },
      ],
      keyEvents: [
        {
          type: { type: "substitution" },
          clock: { displayValue: "35'" },
          participants: [{ athlete: { displayName: "Someone Else" } }, { athlete: { displayName: "Pedro Porro" } }],
        },
      ],
    };

    expect(findCleanSheetIneligibleAssetIds(json, completedDraw)).toEqual(["sac-4"]);
  });

  it("does not exclude a starter who was subbed off after 60 minutes", () => {
    const json: EspnSummaryResponse = {
      rosters: [
        {
          homeAway: "home",
          roster: [{ starter: true, subbedIn: false, athlete: { displayName: "Pedro Porro" } }],
        },
      ],
      keyEvents: [
        {
          type: { type: "substitution" },
          clock: { displayValue: "75'" },
          participants: [{ athlete: { displayName: "Someone Else" } }, { athlete: { displayName: "Pedro Porro" } }],
        },
      ],
    };

    expect(findCleanSheetIneligibleAssetIds(json, completedDraw)).toEqual([]);
  });
});

describe("EspnProvider.getLiveEvents", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // m22: Ghana vs Panama - Mohammed Kudus (saul-5) scores, assisted by
  // Jordan Ayew (jamie-1). Regression test for a bug where a match that
  // went straight from "live" to "completed" between polls (e.g. its
  // entire live window fell inside one /api/live cache window) never had
  // its goal/assist key-events fetched at all, silently dropping the
  // points - only the final-score-derived bonuses still landed.
  const m22 = SEED_MATCHES.find((m) => m.id === "m22")!;
  const summary: EspnSummaryResponse = {
    keyEvents: [
      {
        type: { type: "goal" },
        text: "Mohammed Kudus scores",
        clock: { displayValue: "34'" },
        participants: [{ athlete: { displayName: "Mohammed Kudus" } }, { athlete: { displayName: "Jordan Ayew" } }],
      },
    ],
  };

  function stubFetchWithSummary() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => summary }) as unknown as Response),
    );
  }

  it("fetches and returns events for a completed match, not just a live one", async () => {
    stubFetchWithSummary();
    const completed: Match = { ...m22, status: "completed", homeScore: 1, awayScore: 0, minute: 90 };

    const events = await new EspnProvider().getLiveEvents([completed]);

    expect(events).toEqual([
      { fixtureId: "m22", assetId: "saul-5", type: "goal", minute: 34, detail: "Mohammed Kudus scores" },
      { fixtureId: "m22", assetId: "jamie-1", type: "assist", minute: 34, detail: "Mohammed Kudus scores" },
    ]);
  });

  it("does not fetch events for a match that hasn't started", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const upcoming: Match = { ...m22, status: "upcoming", homeScore: null, awayScore: null, minute: null };

    const events = await new EspnProvider().getLiveEvents([upcoming]);

    expect(events).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // goal---free-kick is a distinct ESPN subtype - confirmed missing when Kevin
  // Pina's free-kick goal (Uruguay v Cape Verde) didn't score. Now covered by
  // the isGoalEvent prefix match (goal---*) rather than an explicit allowlist.
  it("scores a goal---free-kick event as a goal", async () => {
    const fkSummary: EspnSummaryResponse = {
      keyEvents: [
        {
          type: { type: "goal---free-kick" },
          text: "Kevin Pina scores from a free kick",
          clock: { displayValue: "21'" },
          participants: [{ athlete: { displayName: "Kevin Pina" } }],
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => fkSummary }) as unknown as Response),
    );
    const completed: Match = { ...m22, status: "completed", homeScore: 1, awayScore: 0, minute: 90 };

    const events = await new EspnProvider().getLiveEvents([completed]);

    expect(events).toEqual([
      {
        fixtureId: "m22",
        assetId: "jamie-2",
        type: "goal",
        minute: 21,
        detail: "Kevin Pina scores from a free kick",
      },
    ]);
  });

  // penalty---saved is ESPN's event type when the keeper saves the kick -
  // confirmed missing when Mehdi Taremi's saved penalty (Egypt v Iran) didn't
  // deduct any points. Both saved and missed-target penalties count the same.
  it("scores a penalty---saved event as penalty_missed", async () => {
    const penSummary: EspnSummaryResponse = {
      keyEvents: [
        {
          type: { type: "penalty---saved" },
          text: "Penalty saved. Mehdi Taremi shot saved.",
          clock: { displayValue: "11'" },
          participants: [{ athlete: { displayName: "Mehdi Taremi" } }],
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => penSummary }) as unknown as Response),
    );
    const completed: Match = { ...m22, status: "completed", homeScore: 1, awayScore: 1, minute: 90 };

    const events = await new EspnProvider().getLiveEvents([completed]);

    expect(events).toEqual([
      {
        fixtureId: "m22",
        assetId: "lev-3",
        type: "penalty_missed",
        minute: 11,
        detail: "Penalty saved. Mehdi Taremi shot saved.",
      },
    ]);
  });

  // penalty---saved: ESPN names the keeper in the event text "...by [Name] ([Country])."
  // so we parse that directly rather than relying on the roster.
  it("awards penalty_saved to the keeper named in a penalty---saved event's text", async () => {
    const penSavedNamedSummary: EspnSummaryResponse = {
      keyEvents: [
        {
          type: { type: "penalty---saved" },
          text: "Penalty saved by Alisson (Brazil).",
          clock: { displayValue: "55'" },
          participants: [{ athlete: { displayName: "Mehdi Taremi" } }],
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => penSavedNamedSummary }) as unknown as Response),
    );
    const completed: Match = { ...m22, status: "completed", homeScore: 0, awayScore: 0, minute: 90 };

    const events = await new EspnProvider().getLiveEvents([completed]);

    expect(events).toEqual([
      { fixtureId: "m22", assetId: "lev-3", type: "penalty_missed", minute: 55, detail: "Penalty saved by Alisson (Brazil)." },
      { fixtureId: "m22", assetId: "saul-7", type: "penalty_saved", minute: 55, detail: "Penalty saved by Alisson (Brazil)." },
    ]);
  });

  // penalty---missed: keeper is not mentioned in the event text at all, so we
  // fall back to the roster to find the squad GK on the defending side.
  // m6: Brazil (home) vs Morocco (away). Ben Seghir (josh-4) takes the pen
  // from the away side, so the defending GK is Brazil's Alisson (saul-7).
  it("awards penalty_saved to the defending squad GK from the roster when a penalty---missed has no keeper in text", async () => {
    const m6 = SEED_MATCHES.find((m) => m.id === "m6")!;
    const penMissedSummary: EspnSummaryResponse = {
      keyEvents: [
        {
          type: { type: "penalty---missed" },
          text: "Eliesse Ben Seghir shot missed.",
          clock: { displayValue: "33'" },
          participants: [{ athlete: { displayName: "Eliesse Ben Seghir" } }],
        },
      ],
      rosters: [
        {
          homeAway: "home",
          roster: [{ starter: true, subbedIn: false, athlete: { displayName: "Alisson" } }],
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => penMissedSummary }) as unknown as Response),
    );
    const completed: Match = { ...m6, status: "completed", homeScore: 1, awayScore: 0, minute: 90 };

    const events = await new EspnProvider().getLiveEvents([completed]);

    expect(events).toEqual([
      { fixtureId: "m6", assetId: "josh-4", type: "penalty_missed", minute: 33, detail: "Eliesse Ben Seghir shot missed." },
      { fixtureId: "m6", assetId: "saul-7", type: "penalty_saved", minute: 33, detail: "Eliesse Ben Seghir shot missed." },
    ]);
  });

  // Shootout miss: the opposing squad GK (Alisson, saul-7) should get
  // penalty_saved credit when Morocco miss a kick against Brazil (m6).
  it("awards penalty_saved to the opposing squad GK on a shootout miss", async () => {
    const m6 = SEED_MATCHES.find((m) => m.id === "m6")!;
    const shootoutWithKeeperSummary: EspnSummaryResponse = {
      keyEvents: [],
      rosters: [
        {
          homeAway: "home",
          roster: [{ starter: true, subbedIn: false, athlete: { displayName: "Alisson" } }],
        },
      ],
      shootout: [
        {
          team: "Morocco",
          shots: [{ player: "Eliesse Ben Seghir", didScore: false }],
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => shootoutWithKeeperSummary }) as unknown as Response),
    );
    const completed: Match = { ...m6, status: "completed", homeScore: 1, awayScore: 1, minute: 120 };

    const events = await new EspnProvider().getLiveEvents([completed]);

    expect(events).toEqual([
      {
        fixtureId: "m6",
        assetId: "josh-4",
        type: "penalty_missed",
        minute: 120,
        detail: "Eliesse Ben Seghir misses penalty shootout kick 1",
      },
      {
        fixtureId: "m6",
        assetId: "saul-7",
        type: "penalty_saved",
        minute: 120,
        detail: "Eliesse Ben Seghir misses penalty shootout kick 1",
      },
    ]);
  });

  // Penalty shootouts arrive in ESPN's separate "shootout" field, not
  // keyEvents - confirmed against the real Germany vs Paraguay shootout,
  // where Kai Havertz (lev-1) missed Germany's first kick.
  it("maps shootout kicks to goal/penalty_missed events, separately from keyEvents", async () => {
    const shootoutSummary: EspnSummaryResponse = {
      keyEvents: [],
      shootout: [
        {
          team: "Germany",
          shots: [
            { player: "Kai Havertz", didScore: false },
            { player: "Mohammed Kudus", didScore: true },
          ],
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => shootoutSummary }) as unknown as Response),
    );
    const completed: Match = { ...m22, status: "completed", homeScore: 1, awayScore: 1, minute: 120 };

    const events = await new EspnProvider().getLiveEvents([completed]);

    expect(events).toEqual([
      {
        fixtureId: "m22",
        assetId: "lev-1",
        type: "penalty_missed",
        minute: 120,
        detail: "Kai Havertz misses penalty shootout kick 1",
      },
      {
        fixtureId: "m22",
        assetId: "saul-5",
        type: "goal",
        minute: 120,
        detail: "Mohammed Kudus scores penalty shootout kick 2",
      },
    ]);
  });
});
