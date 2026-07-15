import { describe, expect, it } from "vitest";

import {
  computeDailyProgression,
  getManagerTotal,
  getRemainingMatchCount,
  isTeamPresumedEliminated,
  type LeagueData,
} from "@/lib/selectors";
import {
  SEED_FANTASY_EVENTS,
  SEED_MANAGERS,
  SEED_MANUAL_ADJUSTMENTS,
  SEED_MATCHES,
  SEED_SQUAD_ASSETS,
} from "@/lib/data/seed";
import { DEFAULT_SCORING_VALUES } from "@/lib/scoring";
import type { FantasyEvent, Manager, Match } from "@/lib/types";

function makeMatch(overrides: Partial<Match> & { id: string }): Match {
  return {
    stage: "Group Stage",
    homeTeam: "Argentina",
    homeCountryCode: "AR",
    awayTeam: "Mexico",
    awayCountryCode: "MX",
    kickoff: "2026-06-11T17:00Z",
    status: "upcoming",
    homeScore: null,
    awayScore: null,
    minute: null,
    venue: "Stadium",
    locked: false,
    ...overrides,
  };
}

function makeData(matches: Match[]): LeagueData {
  return {
    managers: [],
    squadAssets: [],
    matches,
    fantasyEvents: [],
    manualAdjustments: [],
    scoringValues: {} as LeagueData["scoringValues"],
    auditLog: [],
  };
}

describe("getRemainingMatchCount", () => {
  it("counts upcoming and live matches for a country", () => {
    const data = makeData([
      makeMatch({ id: "m1", homeTeam: "Argentina", status: "completed", homeScore: 2, awayScore: 0 }),
      makeMatch({ id: "m2", homeTeam: "Argentina", status: "upcoming" }),
      makeMatch({ id: "m3", awayTeam: "Argentina", status: "live" }),
    ]);

    expect(getRemainingMatchCount(data, "Argentina")).toBe(2);
  });

  it("returns 0 for a country with no remaining matches", () => {
    const data = makeData([
      makeMatch({ id: "m1", homeTeam: "Argentina", status: "completed", homeScore: 2, awayScore: 0 }),
    ]);

    expect(getRemainingMatchCount(data, "Argentina")).toBe(0);
  });
});

describe("isTeamPresumedEliminated", () => {
  it("is false while the team still has an upcoming or live match", () => {
    const data = makeData([
      makeMatch({ id: "m1", homeTeam: "Argentina", status: "completed", homeScore: 0, awayScore: 1 }),
      makeMatch({ id: "m2", homeTeam: "Argentina", status: "upcoming" }),
    ]);

    expect(isTeamPresumedEliminated(data, "Argentina")).toBe(false);
  });

  it("is true once a team's last completed match was a loss and no matches remain", () => {
    const data = makeData([
      makeMatch({ id: "m1", homeTeam: "Argentina", status: "completed", homeScore: 2, awayScore: 1 }),
      makeMatch({
        id: "m2",
        homeTeam: "Mexico",
        awayTeam: "Argentina",
        status: "completed",
        homeScore: 1,
        awayScore: 0,
        kickoff: "2026-06-15T17:00Z",
      }),
    ]);

    expect(isTeamPresumedEliminated(data, "Argentina")).toBe(true);
  });

  it("is false once a team's last completed match was a win and no matches remain", () => {
    const data = makeData([
      makeMatch({ id: "m1", homeTeam: "Argentina", status: "completed", homeScore: 0, awayScore: 0 }),
      makeMatch({
        id: "m2",
        homeTeam: "Argentina",
        status: "completed",
        homeScore: 2,
        awayScore: 1,
        kickoff: "2026-06-15T17:00Z",
      }),
    ]);

    expect(isTeamPresumedEliminated(data, "Argentina")).toBe(false);
  });

  it("is false for a country with no matches at all", () => {
    const data = makeData([]);
    expect(isTeamPresumedEliminated(data, "Nowhere")).toBe(false);
  });
});

describe("computeDailyProgression", () => {
  const managers: Manager[] = [
    { id: "a", name: "Ana", initials: "AN", color: "#111" },
    { id: "b", name: "Bo", initials: "BO", color: "#222" },
  ];

  function makeEvent(overrides: Partial<FantasyEvent> & { id: string }): FantasyEvent {
    return {
      matchId: "m1",
      assetId: "x",
      managerId: "a",
      type: "goal",
      points: 4,
      minute: 10,
      detail: null,
      createdAt: "2026-06-11T20:00:00Z",
      source: "seed",
      eventHash: null,
      ...overrides,
    };
  }

  function progressionData(events: FantasyEvent[]): LeagueData {
    return {
      managers,
      squadAssets: [],
      matches: [],
      fantasyEvents: events,
      manualAdjustments: [],
      scoringValues: {} as LeagueData["scoringValues"],
      auditLog: [],
    };
  }

  it("returns empty days but one series per manager when nothing is scored", () => {
    const result = computeDailyProgression(progressionData([]));
    expect(result.days).toEqual([]);
    expect(result.series.map((s) => s.manager.id)).toEqual(["a", "b"]);
    expect(result.series.every((s) => s.finalTotal === 0)).toBe(true);
  });

  it("accumulates points per manager and carries flat days forward", () => {
    const result = computeDailyProgression(
      progressionData([
        makeEvent({ id: "e1", managerId: "a", points: 4, createdAt: "2026-06-11T20:00:00Z" }),
        // No scoring on Jun 12 - line should stay flat across the gap.
        makeEvent({ id: "e2", managerId: "a", points: 2, createdAt: "2026-06-13T20:00:00Z" }),
        makeEvent({ id: "e3", managerId: "b", points: 5, createdAt: "2026-06-13T21:00:00Z" }),
      ]),
    );

    // Continuous range Jun 11, 12, 13.
    expect(result.days.map((d) => d.date)).toEqual(["2026-06-11", "2026-06-12", "2026-06-13"]);

    const ana = result.series.find((s) => s.manager.id === "a")!;
    const bo = result.series.find((s) => s.manager.id === "b")!;
    expect(ana.totals).toEqual([4, 4, 6]);
    expect(bo.totals).toEqual([0, 0, 5]);
    expect(ana.finalTotal).toBe(6);
    expect(result.maxTotal).toBe(6);
  });

  it("dates events by their match's kickoff day, not createdAt", () => {
    // Both events were written at the same instant (as result events are when
    // re-derived on a single ingest run) but belong to matches on different
    // days - they must land on their kickoff days, not the ingest day.
    const ingestedAt = "2026-06-20T09:00:00Z";
    const data: LeagueData = {
      managers,
      squadAssets: [],
      matches: [
        makeMatch({ id: "m1", kickoff: "2026-06-11T19:00:00Z" }),
        makeMatch({ id: "m2", kickoff: "2026-06-13T19:00:00Z" }),
      ],
      fantasyEvents: [
        makeEvent({ id: "e1", managerId: "a", matchId: "m1", points: 4, createdAt: ingestedAt }),
        makeEvent({ id: "e2", managerId: "a", matchId: "m2", points: 2, createdAt: ingestedAt }),
      ],
      manualAdjustments: [],
      scoringValues: {} as LeagueData["scoringValues"],
      auditLog: [],
    };
    const result = computeDailyProgression(data);
    expect(result.days.map((d) => d.date)).toEqual(["2026-06-11", "2026-06-12", "2026-06-13"]);
    expect(result.series.find((s) => s.manager.id === "a")!.totals).toEqual([4, 4, 6]);
  });

  it("falls back to createdAt for an event with no match", () => {
    const data: LeagueData = {
      managers,
      squadAssets: [],
      matches: [],
      fantasyEvents: [
        makeEvent({ id: "e1", managerId: "a", matchId: null, points: 3, createdAt: "2026-06-11T20:00:00Z" }),
      ],
      manualAdjustments: [],
      scoringValues: {} as LeagueData["scoringValues"],
      auditLog: [],
    };
    const result = computeDailyProgression(data);
    expect(result.days.map((d) => d.date)).toEqual(["2026-06-11"]);
    expect(result.series.find((s) => s.manager.id === "a")!.totals).toEqual([3]);
  });

  it("tracks negative dips and reports minTotal", () => {
    const result = computeDailyProgression(
      progressionData([makeEvent({ id: "e1", managerId: "a", type: "team_loss", points: -1 })]),
    );
    expect(result.series.find((s) => s.manager.id === "a")!.totals).toEqual([-1]);
    expect(result.minTotal).toBe(-1);
  });

  it("ranks managers each day using the leaderboard tie-break", () => {
    const result = computeDailyProgression(
      progressionData([
        makeEvent({ id: "e1", managerId: "b", points: 3, createdAt: "2026-06-11T20:00:00Z" }),
        makeEvent({ id: "e2", managerId: "a", points: 10, createdAt: "2026-06-12T20:00:00Z" }),
      ]),
    );
    const ana = result.series.find((s) => s.manager.id === "a")!;
    const bo = result.series.find((s) => s.manager.id === "b")!;
    // Day 1: Bo leads. Day 2: Ana overtakes.
    expect(ana.ranks).toEqual([2, 1]);
    expect(bo.ranks).toEqual([1, 2]);
  });

  it("final totals match getManagerTotal for the real seed data", () => {
    const data: LeagueData = {
      managers: SEED_MANAGERS,
      squadAssets: SEED_SQUAD_ASSETS,
      matches: SEED_MATCHES,
      fantasyEvents: SEED_FANTASY_EVENTS,
      manualAdjustments: SEED_MANUAL_ADJUSTMENTS,
      scoringValues: DEFAULT_SCORING_VALUES,
      auditLog: [],
    };
    const result = computeDailyProgression(data);
    for (const s of result.series) {
      expect(s.finalTotal).toBe(getManagerTotal(data, s.manager.id));
    }
  });
});
