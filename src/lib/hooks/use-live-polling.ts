"use client";

import { useEffect } from "react";

import { getApiProvider, isMockMode } from "@/lib/api";
import { useLeagueStore } from "@/lib/store/league-store";

const DEFAULT_INTERVAL_MS = 60_000;

/**
 * Polls the active sports-data provider for match status/score updates
 * and, while any match is live, new fantasy events - ingesting both
 * into the store. New events are deduped via `ingestApiEvents`.
 *
 * Defaults to 60s, or `NEXT_PUBLIC_LIVE_POLL_INTERVAL_MS` if set. On
 * API-Football's free tier (100 requests/day), set this to several
 * minutes - polling every 60s would exceed the daily quota well before
 * a match finishes.
 */
export function useLivePolling(intervalMs?: number) {
  const ingestApiEvents = useLeagueStore((state) => state.ingestApiEvents);
  const syncMatches = useLeagueStore((state) => state.syncMatches);

  useEffect(() => {
    const provider = getApiProvider();
    const source = isMockMode() ? "mock" : "api";
    const interval = intervalMs ?? (Number(process.env.NEXT_PUBLIC_LIVE_POLL_INTERVAL_MS) || DEFAULT_INTERVAL_MS);
    let cancelled = false;

    const poll = async () => {
      const apiMatches = await provider.getMatches();
      if (cancelled) return;
      if (apiMatches.length > 0) syncMatches(apiMatches);

      const liveMatches = useLeagueStore.getState().matches.filter((m) => m.status === "live");
      if (liveMatches.length === 0) return;

      const events = await provider.getLiveEvents(liveMatches);
      if (!cancelled && events.length > 0) {
        ingestApiEvents(events, source);
      }
    };

    poll();
    const id = setInterval(poll, interval);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs, ingestApiEvents, syncMatches]);
}
