"use client";

import { createContext, useContext } from "react";

export interface LiveStatus {
  /** When the live provider was last successfully polled, or null before the first poll completes. */
  lastUpdatedAt: Date | null;
  /** True while a poll request is in flight. */
  isFetching: boolean;
  /** Whether the app is running against the mock provider or a real API. */
  source: "mock" | "api";
  /** Triggers an immediate poll. No-ops if one is already in flight. */
  refresh: () => void;
}

const defaultStatus: LiveStatus = {
  lastUpdatedAt: null,
  isFetching: false,
  source: "mock",
  refresh: () => {},
};

export const LiveStatusContext = createContext<LiveStatus>(defaultStatus);

export function useLiveStatus(): LiveStatus {
  return useContext(LiveStatusContext);
}
