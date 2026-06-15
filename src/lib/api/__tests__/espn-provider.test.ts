import { describe, expect, it } from "vitest";

import { discoverDynamicMatches, resolveSquadCountry, type EspnEvent } from "@/lib/api/espn-provider";
import { ESPN_FIXTURE_ID_MAP } from "@/lib/data/espn-fixture-map";

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
