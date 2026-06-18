import { describe, expect, it } from "vitest";

import { getRemainingMatchCount, isTeamPresumedEliminated, type LeagueData } from "@/lib/selectors";
import type { Match } from "@/lib/types";

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
