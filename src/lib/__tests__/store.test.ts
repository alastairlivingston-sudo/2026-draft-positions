import { beforeEach, describe, expect, it } from "vitest";

import { getAssetPoints, getManagerTotal } from "@/lib/selectors";
import { useLeagueStore } from "@/lib/store/league-store";

beforeEach(() => {
  useLeagueStore.getState().resetToSeed();
});

describe("ingestApiEvents", () => {
  it("ignores duplicate API events with the same dedup hash", () => {
    const raw = {
      fixtureId: "m5",
      assetId: "sanford-1",
      type: "goal" as const,
      minute: 12,
      detail: "Header from a corner",
    };

    const before = useLeagueStore.getState().fantasyEvents.length;

    const firstCount = useLeagueStore.getState().ingestApiEvents([raw], "api");
    expect(firstCount).toBe(1);
    expect(useLeagueStore.getState().fantasyEvents.length).toBe(before + 1);

    const secondCount = useLeagueStore.getState().ingestApiEvents([raw], "api");
    expect(secondCount).toBe(0);
    expect(useLeagueStore.getState().fantasyEvents.length).toBe(before + 1);
  });
});

describe("addManualAdjustment", () => {
  it("updates the affected manager's total", () => {
    const before = getManagerTotal(useLeagueStore.getState(), "ally");

    useLeagueStore.getState().addManualAdjustment({
      managerId: "ally",
      assetId: null,
      points: -2,
      reason: "Test penalty",
    });

    const after = getManagerTotal(useLeagueStore.getState(), "ally");
    expect(after).toBe(before - 2);
  });

  it("updates the affected asset's total when an assetId is provided", () => {
    const before = getAssetPoints(useLeagueStore.getState(), "ally-1");

    useLeagueStore.getState().addManualAdjustment({
      managerId: "ally",
      assetId: "ally-1",
      points: 3,
      reason: "Bonus points",
    });

    const after = getAssetPoints(useLeagueStore.getState(), "ally-1");
    expect(after).toBe(before + 3);
  });
});

describe("updateScoringValues", () => {
  it("recalculates historical event points when mode is 'recalculate'", () => {
    const state = useLeagueStore.getState();
    const goalEvent = state.fantasyEvents.find((e) => e.assetId === "ally-1" && e.type === "goal");
    expect(goalEvent?.points).toBe(4);

    useLeagueStore.getState().updateScoringValues({ ...state.scoringValues, goal: 6 }, "recalculate");

    const updatedEvent = useLeagueStore.getState().fantasyEvents.find((e) => e.id === goalEvent!.id);
    expect(updatedEvent?.points).toBe(6);
  });

  it("leaves historical event points untouched when mode is 'forward'", () => {
    const state = useLeagueStore.getState();
    const goalEvent = state.fantasyEvents.find((e) => e.assetId === "ally-1" && e.type === "goal");
    expect(goalEvent?.points).toBe(4);

    useLeagueStore.getState().updateScoringValues({ ...state.scoringValues, goal: 6 }, "forward");

    const updatedEvent = useLeagueStore.getState().fantasyEvents.find((e) => e.id === goalEvent!.id);
    expect(updatedEvent?.points).toBe(4);
    expect(useLeagueStore.getState().scoringValues.goal).toBe(6);
  });
});

describe("syncMatches", () => {
  it("updates match status/score and ingests result events for a newly-completed match", () => {
    const before = useLeagueStore.getState().matches.find((m) => m.id === "m6")!;
    expect(before.status).toBe("upcoming");

    const polakBefore = getManagerTotal(useLeagueStore.getState(), "polak");

    useLeagueStore.getState().syncMatches([
      { ...before, status: "completed", homeScore: 3, awayScore: 1, minute: 90 },
    ]);

    const state = useLeagueStore.getState();
    const after = state.matches.find((m) => m.id === "m6")!;
    expect(after.status).toBe("completed");
    expect(after.homeScore).toBe(3);
    expect(after.awayScore).toBe(1);

    // Norway (polak-8, a "Team" asset) won and scored 3+.
    const norwayEvents = state.fantasyEvents.filter((e) => e.assetId === "polak-8" && e.matchId === "m6");
    expect(norwayEvents.map((e) => e.type)).toEqual(expect.arrayContaining(["team_win", "team_scored_3plus"]));
    expect(getManagerTotal(state, "polak")).toBe(polakBefore + 2);
  });

  it("does not duplicate result events when synced again", () => {
    const before = useLeagueStore.getState().matches.find((m) => m.id === "m6")!;
    useLeagueStore.getState().syncMatches([{ ...before, status: "completed", homeScore: 3, awayScore: 1, minute: 90 }]);

    const afterFirst = useLeagueStore.getState().fantasyEvents.length;
    useLeagueStore.getState().syncMatches([{ ...before, status: "completed", homeScore: 3, awayScore: 1, minute: 90 }]);

    expect(useLeagueStore.getState().fantasyEvents.length).toBe(afterFirst);
  });

  it("does not modify locked matches", () => {
    const before = useLeagueStore.getState().matches.find((m) => m.id === "m1")!;
    expect(before.locked).toBe(true);

    useLeagueStore.getState().syncMatches([{ ...before, homeScore: 99, awayScore: 99 }]);

    const after = useLeagueStore.getState().matches.find((m) => m.id === "m1")!;
    expect(after.homeScore).toBe(before.homeScore);
    expect(after.awayScore).toBe(before.awayScore);
  });
});

describe("audit log", () => {
  it("records manual adjustments", () => {
    const before = useLeagueStore.getState().auditLog.length;

    useLeagueStore.getState().addManualAdjustment({
      managerId: "ally",
      assetId: null,
      points: -1,
      reason: "Late squad change",
    });

    const auditLog = useLeagueStore.getState().auditLog;
    expect(auditLog.length).toBe(before + 1);
    expect(auditLog[0].action).toBe("manual_adjustment");
    expect(auditLog[0].managerId).toBe("ally");
    expect(auditLog[0].reason).toBe("Late squad change");
  });

  it("records lock/unlock match actions", () => {
    const before = useLeagueStore.getState().auditLog.length;
    const wasLocked = useLeagueStore.getState().matches.find((m) => m.id === "m5")!.locked;

    useLeagueStore.getState().toggleMatchLock("m5");

    const state = useLeagueStore.getState();
    expect(state.matches.find((m) => m.id === "m5")!.locked).toBe(!wasLocked);
    expect(state.auditLog.length).toBe(before + 1);
    expect(state.auditLog[0].action).toBe("lock_match");
  });
});
