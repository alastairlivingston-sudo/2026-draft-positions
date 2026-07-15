"use client";

import { PointsJourneyChart } from "@/components/chart/points-journey-chart";
import { ShareBar } from "@/components/shared/share-bar";

export default function TrendsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Points Race</h1>
          <p className="text-sm text-muted-foreground">
            Watch every manager&apos;s cumulative points race day by day. Hit play, or scrub through the tournament
            yourself.
          </p>
        </div>
        <ShareBar />
      </div>

      <PointsJourneyChart />
    </div>
  );
}
