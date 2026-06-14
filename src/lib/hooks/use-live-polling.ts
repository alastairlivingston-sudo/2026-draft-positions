"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getApiProvider, isMockMode } from "@/lib/api";
import type { LiveStatus } from "@/lib/contexts/live-status-context";
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
 *
 * Returns the current poll status (last update time, in-flight state,
 * data source) plus a `refresh` function for an on-demand poll.
 */
export function useLivePolling(intervalMs?: number): LiveStatus {
  const ingestApiEvents = useLeagueStore((state) => state.ingestApiEvents);
  const syncMatches = useLeagueStore((state) => state.syncMatches);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const fetchingRef = useRef(false);
  const source = isMockMode() ? "mock" : "api";

  const poll = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsFetching(true);

    try {
      const provider = getApiProvider();
      const apiMatches = await provider.getMatches();
      if (apiMatches.length > 0) syncMatches(apiMatches);

      const liveMatches = useLeagueStore.getState().matches.filter((m) => m.status === "live");
      if (liveMatches.length > 0) {
        const events = await provider.getLiveEvents(liveMatches);
        if (events.length > 0) ingestApiEvents(events, source);
      }

      setLastUpdatedAt(new Date());
    } finally {
      fetchingRef.current = false;
      setIsFetching(false);
    }
  }, [ingestApiEvents, syncMatches, source]);

  useEffect(() => {
    const interval = intervalMs ?? (Number(process.env.NEXT_PUBLIC_LIVE_POLL_INTERVAL_MS) || DEFAULT_INTERVAL_MS);
    poll();
    const id = setInterval(poll, interval);
    return () => clearInterval(id);
  }, [intervalMs, poll]);

  return { lastUpdatedAt, isFetching, source, refresh: poll };
}
