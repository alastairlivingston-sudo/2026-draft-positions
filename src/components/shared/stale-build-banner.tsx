"use client";

import { RefreshCw } from "lucide-react";

import { useLiveStatus } from "@/lib/contexts/live-status-context";

/** Prompts a reload when a deploy has landed since this tab loaded its JS - see useLivePolling's staleBuild check. */
export function StaleBuildBanner() {
  const { staleBuild } = useLiveStatus();
  if (!staleBuild) return null;

  return (
    <div className="flex items-center justify-center gap-3 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
      <span>A new version of the app is available.</span>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1 font-bold transition-colors hover:bg-primary-foreground/25"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh
      </button>
    </div>
  );
}
