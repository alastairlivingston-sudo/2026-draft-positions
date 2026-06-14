import { describe, expect, it } from "vitest";

import { calculateEventPoints, DEFAULT_SCORING_VALUES, isEventEligible } from "@/lib/scoring";
import type { SquadAsset } from "@/lib/types";

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
