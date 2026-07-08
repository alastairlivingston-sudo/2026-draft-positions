import { describe, expect, it } from "vitest";

import {
  SEED_AUDIT_LOG,
  SEED_FANTASY_EVENTS,
  SEED_MANAGERS,
  SEED_MANUAL_ADJUSTMENTS,
  SEED_MATCHES,
  SEED_SQUAD_ASSETS,
} from "@/lib/data/seed";
import { DEFAULT_ADMIN_ACTOR } from "@/lib/store/mutations";
import {
  applyAddFantasyEvent,
  applyAddManualAdjustment,
  applyDeleteFantasyEvent,
  applyDeleteManualAdjustment,
  applyRecalculateAllPoints,
  applyToggleMatchLock,
  applyUpdateFantasyEvent,
  applyUpdateMatchResult,
  applyUpdateScoringValues,
  applyUpdateSquadAsset,
} from "@/lib/store/mutations";
import { getAssetPoints, getManagerTotal, type LeagueData } from "@/lib/selectors";
import { DEFAULT_SCORING_VALUES } from "@/lib/scoring";
import type { FantasyEvent } from "@/lib/types";

function seedData(): LeagueData {
  return {
    managers: SEED_MANAGERS,
    squadAssets: SEED_SQUAD_ASSETS,
    matches: SEED_MATCHES,
    fantasyEvents: SEED_FANTASY_EVENTS,
    manualAdjustments: SEED_MANUAL_ADJUSTMENTS,
    scoringValues: DEFAULT_SCORING_VALUES,
    auditLog: SEED_AUDIT_LOG,
  };
}

describe("applyAddFantasyEvent / applyUpdateFantasyEvent / applyDeleteFantasyEvent", () => {
  it("adds a manual event with computed points and an audit entry", () => {
    const data = seedData();
    const next = applyAddFantasyEvent(
      data,
      { matchId: null, assetId: "ally-1", type: "goal", minute: null, detail: "Late add" },
      DEFAULT_ADMIN_ACTOR,
    )!;

    expect(next.fantasyEvents.length).toBe(data.fantasyEvents.length + 1);
    const added = next.fantasyEvents.at(-1)!;
    expect(added.points).toBe(DEFAULT_SCORING_VALUES.goal);
    expect(added.source).toBe("manual");
    expect(next.auditLog[0].action).toBe("create_event");
  });

  it("returns null for an unknown asset id", () => {
    const data = seedData();
    expect(applyAddFantasyEvent(data, { matchId: null, assetId: "nope", type: "goal", minute: null, detail: "" }, DEFAULT_ADMIN_ACTOR)).toBeNull();
  });

  it("recomputes points when an event's type is edited", () => {
    const data = seedData();
    const existing = data.fantasyEvents.find((e) => e.assetId === "lev-1" && e.type === "goal")!;

    const next = applyUpdateFantasyEvent(data, existing.id, { type: "assist" }, "Corrected event type", DEFAULT_ADMIN_ACTOR)!;

    const updated = next.fantasyEvents.find((e) => e.id === existing.id)!;
    expect(updated.type).toBe("assist");
    expect(updated.points).toBe(DEFAULT_SCORING_VALUES.assist);
    expect(next.auditLog[0].action).toBe("update_event");
  });

  it("removes an event and records the deletion in the audit log", () => {
    const data = seedData();
    const existing = data.fantasyEvents[0];

    const next = applyDeleteFantasyEvent(data, existing.id, "Duplicate entry", DEFAULT_ADMIN_ACTOR)!;

    expect(next.fantasyEvents.some((e) => e.id === existing.id)).toBe(false);
    expect(next.auditLog[0].action).toBe("delete_event");
  });
});

describe("applyAddManualAdjustment / applyDeleteManualAdjustment", () => {
  it("updates the affected manager's total", () => {
    const data = seedData();
    const before = getManagerTotal(data, "ally");

    const next = applyAddManualAdjustment(data, { managerId: "ally", assetId: null, points: -2, reason: "Test penalty" }, DEFAULT_ADMIN_ACTOR)!;

    expect(getManagerTotal(next, "ally")).toBe(before - 2);
  });

  it("updates the affected asset's total when an assetId is provided", () => {
    const data = seedData();
    const before = getAssetPoints(data, "ally-1");

    const next = applyAddManualAdjustment(data, { managerId: "ally", assetId: "ally-1", points: 3, reason: "Bonus points" }, DEFAULT_ADMIN_ACTOR)!;

    expect(getAssetPoints(next, "ally-1")).toBe(before + 3);
  });

  it("removes an adjustment and records the deletion in the audit log", () => {
    const data = seedData();
    const added = applyAddManualAdjustment(data, { managerId: "ally", assetId: null, points: -1, reason: "Late change" }, DEFAULT_ADMIN_ACTOR)!;
    const adjustment = added.manualAdjustments.at(-1)!;

    const next = applyDeleteManualAdjustment(added, adjustment.id, "Reverted", DEFAULT_ADMIN_ACTOR)!;

    expect(next.manualAdjustments.some((a) => a.id === adjustment.id)).toBe(false);
    expect(next.auditLog[0].action).toBe("delete_adjustment");
  });
});

describe("applyUpdateScoringValues", () => {
  it("recalculates historical event points when mode is 'recalculate'", () => {
    const data = seedData();
    const goalEvent = data.fantasyEvents.find((e) => e.assetId === "polak-2" && e.type === "goal")!;
    expect(goalEvent.points).toBe(4);

    const next = applyUpdateScoringValues(data, { ...data.scoringValues, goal: 6 }, "recalculate", DEFAULT_ADMIN_ACTOR);

    expect(next.fantasyEvents.find((e) => e.id === goalEvent.id)!.points).toBe(6);
  });

  it("leaves historical event points untouched when mode is 'forward'", () => {
    const data = seedData();
    const goalEvent = data.fantasyEvents.find((e) => e.assetId === "polak-2" && e.type === "goal")!;

    const next = applyUpdateScoringValues(data, { ...data.scoringValues, goal: 6 }, "forward", DEFAULT_ADMIN_ACTOR);

    expect(next.fantasyEvents.find((e) => e.id === goalEvent.id)!.points).toBe(4);
    expect(next.scoringValues.goal).toBe(6);
  });
});

describe("applyRecalculateAllPoints", () => {
  it("recomputes every event's points from the current scoring values", () => {
    const data = seedData();
    const withNewGoalValue = { ...data, scoringValues: { ...data.scoringValues, goal: 10 } };
    const goalEvent = data.fantasyEvents.find((e) => e.type === "goal")!;

    const next = applyRecalculateAllPoints(withNewGoalValue, DEFAULT_ADMIN_ACTOR);

    expect(next.fantasyEvents.find((e) => e.id === goalEvent.id)!.points).toBe(10);
    expect(next.auditLog[0].action).toBe("recalculate_points");
  });
});

describe("applyToggleMatchLock", () => {
  it("flips a match's locked flag and records the audit action", () => {
    const data = seedData();
    const wasLocked = data.matches.find((m) => m.id === "m14")!.locked;

    const next = applyToggleMatchLock(data, "m14", DEFAULT_ADMIN_ACTOR)!;

    expect(next.matches.find((m) => m.id === "m14")!.locked).toBe(!wasLocked);
    expect(next.auditLog[0].action).toBe(wasLocked ? "unlock_match" : "lock_match");
  });
});

describe("applyUpdateMatchResult", () => {
  it("updates match status/score and derives result events for a newly-completed match", () => {
    const data = seedData();
    const before = data.matches.find((m) => m.id === "m18")!;
    expect(before.status).toBe("upcoming");
    const polakBefore = getManagerTotal(data, "polak");

    const next = applyUpdateMatchResult(data, "m18", { status: "completed", homeScore: 1, awayScore: 3, minute: 90 }, DEFAULT_ADMIN_ACTOR)!;

    const after = next.matches.find((m) => m.id === "m18")!;
    expect(after.status).toBe("completed");

    // Norway (polak-8, a "Team" asset) won and scored 3+.
    const norwayEvents = next.fantasyEvents.filter((e) => e.assetId === "polak-8" && e.matchId === "m18");
    expect(norwayEvents.map((e) => e.type)).toEqual(expect.arrayContaining(["team_win", "team_scored_3plus"]));
    expect(getManagerTotal(next, "polak")).toBe(polakBefore + 2);
  });

  it("does not duplicate result events when applied again with the same score", () => {
    const data = seedData();
    const first = applyUpdateMatchResult(data, "m18", { status: "completed", homeScore: 1, awayScore: 3, minute: 90 }, DEFAULT_ADMIN_ACTOR)!;

    const second = applyUpdateMatchResult(first, "m18", { status: "completed", homeScore: 1, awayScore: 3, minute: 90 }, DEFAULT_ADMIN_ACTOR)!;

    expect(second.fantasyEvents.length).toBe(first.fantasyEvents.length);
  });

  it("applies the corrected result bonus when a later correction fixes an already-completed match's score", () => {
    // Regression test: a score correction on an already-"completed" match
    // must re-derive its result events, not just on the first transition
    // to completed - otherwise a wrong initial score's bonus sticks forever.
    const data = seedData();
    const polakBefore = getManagerTotal(data, "polak");

    const draw = applyUpdateMatchResult(data, "m18", { status: "completed", homeScore: 1, awayScore: 1, minute: 90 }, DEFAULT_ADMIN_ACTOR)!;
    expect(getManagerTotal(draw, "polak")).toBe(polakBefore);

    const corrected = applyUpdateMatchResult(draw, "m18", { status: "completed", homeScore: 1, awayScore: 3, minute: 90 }, DEFAULT_ADMIN_ACTOR)!;
    expect(getManagerTotal(corrected, "polak")).toBe(polakBefore + 2);
  });

  it("returns null for an unknown match id", () => {
    const data = seedData();
    expect(applyUpdateMatchResult(data, "nope", { status: "completed" }, DEFAULT_ADMIN_ACTOR)).toBeNull();
  });

  it("does not duplicate a result event a curated seed event already covers for the same match/asset/type/minute", () => {
    // Regression test: seed data can include a curated result event
    // (source: "seed", eventHash: null) for a match an admin later
    // corrects - the freshly-derived event must recognize it as the same
    // real-world thing and skip it, not add a second copy under a new id.
    const data = seedData();
    const polakBefore = getManagerTotal(data, "polak");

    const seededTeamWin: FantasyEvent = {
      id: "evt-seed-team-win",
      matchId: "m18",
      assetId: "polak-8",
      managerId: "polak",
      type: "team_win",
      points: 1,
      minute: 90,
      detail: "Norway win 1-3",
      createdAt: "2026-06-16T22:00:00Z",
      source: "seed",
      eventHash: null,
    };
    const withSeedEvent: LeagueData = { ...data, fantasyEvents: [...data.fantasyEvents, seededTeamWin] };

    const next = applyUpdateMatchResult(withSeedEvent, "m18", { status: "completed", homeScore: 1, awayScore: 3, minute: 90 }, DEFAULT_ADMIN_ACTOR)!;

    const norwayEvents = next.fantasyEvents.filter((e) => e.assetId === "polak-8" && e.matchId === "m18");
    expect(norwayEvents.filter((e) => e.type === "team_win")).toHaveLength(1);
    expect(norwayEvents.map((e) => e.type)).toEqual(expect.arrayContaining(["team_win", "team_scored_3plus"]));
    // The pre-existing seed team_win (1pt) + freshly-derived team_scored_3plus (1pt) - not two team_wins.
    expect(getManagerTotal(next, "polak")).toBe(polakBefore + 2);
  });
});

describe("applyUpdateSquadAsset", () => {
  it("strips an already-recorded clean_sheet bonus when newly flagged unavailable", () => {
    const data = seedData();
    const asset = data.squadAssets.find((a) => a.id === "sac-4")!;
    const withCleanSheet: LeagueData = {
      ...data,
      fantasyEvents: [
        ...data.fantasyEvents,
        {
          id: "evt-test-clean-sheet",
          matchId: "m35",
          assetId: "sac-4",
          managerId: asset.managerId,
          type: "clean_sheet",
          points: 2,
          minute: 90,
          detail: "Spain keep a clean sheet",
          createdAt: new Date().toISOString(),
          source: "api",
          eventHash: null,
        },
      ],
    };

    const next = applyUpdateSquadAsset(withCleanSheet, "sac-4", { unavailable: true }, DEFAULT_ADMIN_ACTOR)!;

    expect(next.fantasyEvents.some((e) => e.id === "evt-test-clean-sheet")).toBe(false);
    expect(next.squadAssets.find((a) => a.id === "sac-4")!.unavailable).toBe(true);
  });

  it("returns null for an unknown asset id", () => {
    const data = seedData();
    expect(applyUpdateSquadAsset(data, "nope", { unavailable: true }, DEFAULT_ADMIN_ACTOR)).toBeNull();
  });
});
