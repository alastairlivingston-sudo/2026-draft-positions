"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { LiveStatus } from "@/lib/contexts/live-status-context";
import { useLeagueStore } from "@/lib/store/league-store";
import type { Match, RawApiEvent } from "@/lib/types";

const DEFAULT_INTERVAL_MS = 60_000;

interface LiveDataResponse {
  matches: Match[];
  events: RawApiEvent[];
  nonAppearingAssetIds: string[];
  source: "mock" | "api";
  fetchedAt: string;
}

/**
 * Polls `/api/live` for match status/score updates and, while any
 * match is live, new fantasy events - ingesting both into the store.
 * New events are deduped via `ingestApiEvents`.
 *
 * `/api/live` caches the upstream provider response for
 * `LIVE_DATA_CACHE_SECONDS` (default 1 hour) and shares it across all
 * clients, so polling here doesn't multiply the live provider's usage
 * by the number of open browser tabs.
 *
 * Returns the current poll status (last update time, in-flight state,
 * data source) plus a `refresh` function for an on-demand poll.
 */
export function useLivePolling(intervalMs?: number): LiveStatus {
  const ingestApiEvents = useLeagueStore((state) => state.ingestApiEvents);
  const syncMatches = useLeagueStore((state) => state.syncMatches);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [source, setSource] = useState<"mock" | "api">("mock");
  const fetchingRef = useRef(false);

  const poll = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsFetching(true);

    try {
      const res = await fetch("/api/live");
      if (!res.ok) return;
      const data: LiveDataResponse = await res.json();

      if (data.matches.length > 0) syncMatches(data.matches, data.nonAppearingAssetIds);
      if (data.events.length > 0) ingestApiEvents(data.events, data.source);

      setSource(data.source);
      setLastUpdatedAt(new Date(data.fetchedAt));
    } finally {
      fetchingRef.current = false;
      setIsFetching(false);
    }
  }, [ingestApiEvents, syncMatches]);

  useEffect(() => {
    const interval = intervalMs ?? (Number(process.env.NEXT_PUBLIC_LIVE_POLL_INTERVAL_MS) || DEFAULT_INTERVAL_MS);
    poll();
    const id = setInterval(poll, interval);
    return () => clearInterval(id);
  }, [intervalMs, poll]);

  return { lastUpdatedAt, isFetching, source, refresh: poll };
}
