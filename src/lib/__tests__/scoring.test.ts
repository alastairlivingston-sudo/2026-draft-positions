import { describe, expect, it } from "vitest";

import { calculateEventPoints, computeMatchResultEvents, DEFAULT_SCORING_VALUES, isEventEligible } from "@/lib/scoring";
import type { Match, SquadAsset } from "@/lib/types";

type Asset = Pick<SquadAsset, "assetType" | "position">;

const striker: Asset = { assetType: "player", position: "Striker" };
const midfielder: Asset = { assetType: "player", position: "Midfielder" };
const defender: Asset = { assetType: "player", position: "Defender" };
const goalkeeper: Asset = { assetType: "player", position: "Goalkeeper" };
const team: Asset = { assetType: "team", position: "Team" };

describe("calculateEventPoints", () => {
  it("awards +4 for a goal", () => {
    expect(calculateEventPoints("goal", striker, DEFAULT_SCORING_VALUES)).toBe(4);
  });

  it("awards +2 for an assist", () => {
    expect(calculateEventPoints("assist", midfielder, DEFAULT_SCORING_VALUES)).toBe(2);
  });

  it("awards +2 for a clean sheet to a defender", () => {
    expect(calculateEventPoints("clean_sheet", defender, DEFAULT_SCORING_VALUES)).toBe(2);
  });

  it("awards +2 for a clean sheet to a goalkeeper", () => {
    expect(calculateEventPoints("clean_sheet", goalkeeper, DEFAULT_SCORING_VALUES)).toBe(2);
  });

  it("awards 0 for a clean sheet to a midfielder or striker", () => {
    expect(calculateEventPoints("clean_sheet", midfielder, DEFAULT_SCORING_VALUES)).toBe(0);
    expect(calculateEventPoints("clean_sheet", striker, DEFAULT_SCORING_VALUES)).toBe(0);
  });

  it("awards -1 for a yellow card", () => {
    expect(calculateEventPoints("yellow_card", defender, DEFAULT_SCORING_VALUES)).toBe(-1);
  });

  it("awards -2 for a red card", () => {
    expect(calculateEventPoints("red_card", defender, DEFAULT_SCORING_VALUES)).toBe(-2);
  });

  it("awards -2 for an own goal", () => {
    expect(calculateEventPoints("own_goal", defender, DEFAULT_SCORING_VALUES)).toBe(-2);
  });

  it("awards -1 for a missed penalty (incl. shootouts)", () => {
    expect(calculateEventPoints("penalty_missed", striker, DEFAULT_SCORING_VALUES)).toBe(-1);
  });

  it("awards +4 for a penalty saved (incl. shootouts)", () => {
    expect(calculateEventPoints("penalty_saved", goalkeeper, DEFAULT_SCORING_VALUES)).toBe(4);
  });

  it("awards +1 for a team win", () => {
    expect(calculateEventPoints("team_win", team, DEFAULT_SCORING_VALUES)).toBe(1);
  });

  it("awards +1 for a team scoring 3 or more goals", () => {
    expect(calculateEventPoints("team_scored_3plus", team, DEFAULT_SCORING_VALUES)).toBe(1);
  });

  it("awards -1 for a team loss", () => {
    expect(calculateEventPoints("team_loss", team, DEFAULT_SCORING_VALUES)).toBe(-1);
  });

  it("awards -1 for a team conceding 3 or more goals", () => {
    expect(calculateEventPoints("team_conceded_3plus", team, DEFAULT_SCORING_VALUES)).toBe(-1);
  });

  it("never applies team bonuses to player rows", () => {
    expect(isEventEligible(striker, "team_win")).toBe(false);
    expect(calculateEventPoints("team_win", striker, DEFAULT_SCORING_VALUES)).toBe(0);
    expect(calculateEventPoints("team_scored_3plus", goalkeeper, DEFAULT_SCORING_VALUES)).toBe(0);
  });

  it("never applies player scoring to team rows", () => {
    expect(isEventEligible(team, "goal")).toBe(false);
    expect(calculateEventPoints("goal", team, DEFAULT_SCORING_VALUES)).toBe(0);
    expect(calculateEventPoints("yellow_card", team, DEFAULT_SCORING_VALUES)).toBe(0);
  });
});

describe("computeMatchResultEvents", () => {
  const baseMatch: Match = {
    id: "m99",
    stage: "Group Stage · Matchday 1",
    homeTeam: "France",
    homeCountryCode: "FR",
    awayTeam: "Morocco",
    awayCountryCode: "MA",
    kickoff: "2026-06-20T18:00:00Z",
    status: "completed",
    homeScore: 3,
    awayScore: 0,
    minute: 90,
    venue: "Test Stadium",
    locked: false,
  };

  const franceTeam: SquadAsset = { id: "asset-france-team", managerId: "lev", slot: 1, name: "France", country: "France", countryCode: "FR", position: "Team", assetType: "team" };
  const moroccoTeam: SquadAsset = { id: "asset-morocco-team", managerId: "josh", slot: 1, name: "Morocco", country: "Morocco", countryCode: "MA", position: "Team", assetType: "team" };
  const franceDefender: SquadAsset = { id: "asset-france-def", managerId: "lev", slot: 2, name: "Saliba", country: "France", countryCode: "FR", position: "Defender", assetType: "player" };
  const franceStriker: SquadAsset = { id: "asset-france-str", managerId: "lev", slot: 3, name: "Mbappe", country: "France", countryCode: "FR", position: "Striker", assetType: "player" };
  const moroccoKeeper: SquadAsset = { id: "asset-morocco-gk", managerId: "josh", slot: 2, name: "Bounou", country: "Morocco", countryCode: "MA", position: "Goalkeeper", assetType: "player" };

  const squadAssets = [franceTeam, moroccoTeam, franceDefender, franceStriker, moroccoKeeper];

  it("returns no events for a match with no result yet", () => {
    const upcoming: Match = { ...baseMatch, status: "upcoming", homeScore: null, awayScore: null, minute: null };
    expect(computeMatchResultEvents(upcoming, squadAssets)).toEqual([]);
  });

  it("awards team_win and team_scored_3plus to the winning team asset", () => {
    const events = computeMatchResultEvents(baseMatch, squadAssets);
    const franceEvents = events.filter((e) => e.assetId === franceTeam.id);
    expect(franceEvents.map((e) => e.type)).toEqual(expect.arrayContaining(["team_win", "team_scored_3plus"]));
  });

  it("awards team_loss and team_conceded_3plus to the losing team asset", () => {
    const events = computeMatchResultEvents(baseMatch, squadAssets);
    const moroccoEvents = events.filter((e) => e.assetId === moroccoTeam.id);
    expect(moroccoEvents.map((e) => e.type)).toEqual(expect.arrayContaining(["team_loss", "team_conceded_3plus"]));
  });

  it("awards a clean sheet to defenders/goalkeepers on the side that conceded 0", () => {
    const events = computeMatchResultEvents(baseMatch, squadAssets);
    expect(events.filter((e) => e.assetId === franceDefender.id).map((e) => e.type)).toEqual(["clean_sheet"]);
    expect(events.some((e) => e.assetId === moroccoKeeper.id)).toBe(false);
  });

  it("does not award a clean sheet to strikers/midfielders", () => {
    const events = computeMatchResultEvents(baseMatch, squadAssets);
    expect(events.some((e) => e.assetId === franceStriker.id)).toBe(false);
  });

  it("awards neither team_win nor team_loss for a draw", () => {
    const draw: Match = { ...baseMatch, homeScore: 1, awayScore: 1 };
    const events = computeMatchResultEvents(draw, squadAssets);
    expect(events.some((e) => e.type === "team_win" || e.type === "team_loss")).toBe(false);
  });

  it("does not award a clean sheet to a GK/Defender listed in nonPlayingAssetIds", () => {
    const events = computeMatchResultEvents(baseMatch, squadAssets, new Set([franceDefender.id]));
    expect(events.some((e) => e.assetId === franceDefender.id)).toBe(false);
  });

  it("still awards a clean sheet to GK/Defenders not in nonPlayingAssetIds", () => {
    const events = computeMatchResultEvents(baseMatch, squadAssets, new Set(["some-other-asset"]));
    expect(events.filter((e) => e.assetId === franceDefender.id).map((e) => e.type)).toEqual(["clean_sheet"]);
  });

  it("does not award a clean sheet to a GK/Defender flagged unavailable, even with no nonPlayingAssetIds match", () => {
    const omittedDefender: SquadAsset = { ...franceDefender, id: "asset-omitted-def", unavailable: true };
    const events = computeMatchResultEvents(baseMatch, [...squadAssets, omittedDefender]);
    expect(events.some((e) => e.assetId === omittedDefender.id)).toBe(false);
  });
});
