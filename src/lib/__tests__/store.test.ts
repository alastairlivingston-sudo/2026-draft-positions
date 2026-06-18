import { beforeEach, describe, expect, it } from "vitest";

import { getAssetPoints, getManagerTotal } from "@/lib/selectors";
import { dedupeFantasyEvents, useLeagueStore } from "@/lib/store/league-store";
import type { FantasyEvent } from "@/lib/types";

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

  it("ignores an API event that duplicates an existing seed event for the same match/asset/type/minute, even with different wording", () => {
    // evt-9 in SEED_FANTASY_EVENTS: lev-1 (Kai Havertz) scored at minute 45 in
    // m9 with detail "Converts a penalty to make it 3-1". A re-fetch of the
    // same real-world goal from ESPN's keyEvents feed (different `detail`
    // text, source "api" instead of "seed") must not be double-counted -
    // regression test for the Havertz brace showing as four goals instead
    // of two.
    const seedEvent = useLeagueStore
      .getState()
      .fantasyEvents.find((e) => e.matchId === "m9" && e.assetId === "lev-1" && e.minute === 45)!;
    expect(seedEvent.source).toBe("seed");
    expect(seedEvent.eventHash).toBeNull();

    const before = useLeagueStore.getState().fantasyEvents.length;

    const count = useLeagueStore.getState().ingestApiEvents(
      [{ fixtureId: "m9", assetId: "lev-1", type: "goal", minute: 45, detail: "Kai Havertz converts the penalty" }],
      "api",
    );

    expect(count).toBe(0);
    expect(useLeagueStore.getState().fantasyEvents.length).toBe(before);
  });

  it("still records a second real goal by the same player in the same match at a different minute", () => {
    // evt-10: lev-1's second goal in m9, at minute 88.
    const before = useLeagueStore.getState().fantasyEvents.length;

    const count = useLeagueStore.getState().ingestApiEvents(
      [{ fixtureId: "m9", assetId: "lev-1", type: "goal", minute: 12, detail: "An earlier, unrelated goal" }],
      "api",
    );

    expect(count).toBe(1);
    expect(useLeagueStore.getState().fantasyEvents.length).toBe(before + 1);
  });
});

describe("dedupeFantasyEvents", () => {
  function makeEvent(overrides: Partial<FantasyEvent> & { id: string }): FantasyEvent {
    return {
      matchId: "m9",
      assetId: "lev-1",
      managerId: "lev",
      type: "goal",
      points: 4,
      minute: 45,
      detail: "",
      createdAt: "2026-06-14T17:52:00Z",
      source: "seed",
      eventHash: null,
      ...overrides,
    };
  }

  it("collapses a seed event and its later API-sourced duplicate, keeping the earlier one", () => {
    // Mirrors the persisted-state bug: evt-9 (seed) and a same-minute
    // re-fetch from ESPN both ended up in fantasyEvents before the
    // ingestApiEvents dedup fix landed.
    const seedEvent = makeEvent({ id: "evt-9", createdAt: "2026-06-14T17:52:00Z", source: "seed" });
    const duplicateApiEvent = makeEvent({
      id: "evt-dup",
      createdAt: "2026-06-18T09:12:00Z",
      source: "api",
      detail: "Goal! Germany 3, Curacao 1. Kai Havertz (Germany) converts a penalty.",
    });

    expect(dedupeFantasyEvents([seedEvent, duplicateApiEvent])).toEqual([seedEvent]);
  });

  it("keeps two real goals by the same player in the same match at different minutes", () => {
    const first = makeEvent({ id: "evt-9", minute: 45 });
    const second = makeEvent({ id: "evt-10", minute: 88 });

    expect(dedupeFantasyEvents([first, second])).toEqual([first, second]);
  });

  it("never collapses freeform manual events with no matchId", () => {
    const first = makeEvent({ id: "evt-a", matchId: null, minute: null, type: "manual_adjustment" });
    const second = makeEvent({ id: "evt-b", matchId: null, minute: null, type: "manual_adjustment" });

    expect(dedupeFantasyEvents([first, second])).toEqual([first, second]);
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
    const goalEvent = state.fantasyEvents.find((e) => e.assetId === "polak-2" && e.type === "goal");
    expect(goalEvent?.points).toBe(4);

    useLeagueStore.getState().updateScoringValues({ ...state.scoringValues, goal: 6 }, "recalculate");

    const updatedEvent = useLeagueStore.getState().fantasyEvents.find((e) => e.id === goalEvent!.id);
    expect(updatedEvent?.points).toBe(6);
  });

  it("leaves historical event points untouched when mode is 'forward'", () => {
    const state = useLeagueStore.getState();
    const goalEvent = state.fantasyEvents.find((e) => e.assetId === "polak-2" && e.type === "goal");
    expect(goalEvent?.points).toBe(4);

    useLeagueStore.getState().updateScoringValues({ ...state.scoringValues, goal: 6 }, "forward");

    const updatedEvent = useLeagueStore.getState().fantasyEvents.find((e) => e.id === goalEvent!.id);
    expect(updatedEvent?.points).toBe(4);
    expect(useLeagueStore.getState().scoringValues.goal).toBe(6);
  });
});

describe("syncMatches", () => {
  it("updates match status/score and ingests result events for a newly-completed match", () => {
    const before = useLeagueStore.getState().matches.find((m) => m.id === "m18")!;
    expect(before.status).toBe("upcoming");

    const polakBefore = getManagerTotal(useLeagueStore.getState(), "polak");

    useLeagueStore.getState().syncMatches([
      { ...before, status: "completed", homeScore: 1, awayScore: 3, minute: 90 },
    ]);

    const state = useLeagueStore.getState();
    const after = state.matches.find((m) => m.id === "m18")!;
    expect(after.status).toBe("completed");
    expect(after.homeScore).toBe(1);
    expect(after.awayScore).toBe(3);

    // Norway (polak-8, a "Team" asset) won and scored 3+.
    const norwayEvents = state.fantasyEvents.filter((e) => e.assetId === "polak-8" && e.matchId === "m18");
    expect(norwayEvents.map((e) => e.type)).toEqual(expect.arrayContaining(["team_win", "team_scored_3plus"]));
    expect(getManagerTotal(state, "polak")).toBe(polakBefore + 2);
  });

  it("does not duplicate result events when synced again", () => {
    const before = useLeagueStore.getState().matches.find((m) => m.id === "m18")!;
    useLeagueStore.getState().syncMatches([{ ...before, status: "completed", homeScore: 1, awayScore: 3, minute: 90 }]);

    const afterFirst = useLeagueStore.getState().fantasyEvents.length;
    useLeagueStore.getState().syncMatches([{ ...before, status: "completed", homeScore: 1, awayScore: 3, minute: 90 }]);

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

  it("does not award a clean sheet to a squad GK/Defender in nonAppearingAssetIds", () => {
    // m13: Spain vs Cape Verde - Spain's only squad GK/Defender is Pedro Porro (sac-4).
    const before = useLeagueStore.getState().matches.find((m) => m.id === "m13")!;
    expect(before.status).toBe("upcoming");

    useLeagueStore
      .getState()
      .syncMatches([{ ...before, status: "completed", homeScore: 0, awayScore: 0, minute: 90 }], ["sac-4"]);

    const state = useLeagueStore.getState();
    const porroEvents = state.fantasyEvents.filter((e) => e.assetId === "sac-4" && e.matchId === "m13");
    expect(porroEvents.some((e) => e.type === "clean_sheet")).toBe(false);
  });

  it("awards a clean sheet to a squad GK/Defender not in nonAppearingAssetIds", () => {
    const before = useLeagueStore.getState().matches.find((m) => m.id === "m13")!;

    useLeagueStore.getState().syncMatches([{ ...before, status: "completed", homeScore: 0, awayScore: 0, minute: 90 }]);

    const state = useLeagueStore.getState();
    const porroEvents = state.fantasyEvents.filter((e) => e.assetId === "sac-4" && e.matchId === "m13");
    expect(porroEvents.some((e) => e.type === "clean_sheet")).toBe(true);
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
    const wasLocked = useLeagueStore.getState().matches.find((m) => m.id === "m14")!.locked;

    useLeagueStore.getState().toggleMatchLock("m14");

    const state = useLeagueStore.getState();
    expect(state.matches.find((m) => m.id === "m14")!.locked).toBe(!wasLocked);
    expect(state.auditLog.length).toBe(before + 1);
    expect(state.auditLog[0].action).toBe("lock_match");
  });
});
