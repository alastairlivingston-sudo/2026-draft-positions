"use client";

import { useState } from "react";

import { EventFeedItem } from "@/components/events/event-feed-item";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAssetById, getEventFeed, getManagerById } from "@/lib/selectors";
import { useLeagueStore } from "@/lib/store/league-store";

const ALL = "all";

export default function EventsPage() {
  const data = useLeagueStore((s) => s);
  const [managerFilter, setManagerFilter] = useState<string>(ALL);
  const [matchFilter, setMatchFilter] = useState<string>(ALL);

  const feed = getEventFeed(data).filter((entry) => {
    if (managerFilter !== ALL && entry.managerId !== managerFilter) return false;
    if (matchFilter !== ALL && entry.matchId !== matchFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Event Feed</h1>
        <p className="text-sm text-muted-foreground">Every fantasy point awarded so far, newest first</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={managerFilter} onValueChange={(value) => setManagerFilter(value as string)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All managers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All managers</SelectItem>
            {data.managers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={matchFilter} onValueChange={(value) => setMatchFilter(value as string)}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="All matches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All matches</SelectItem>
            {data.matches.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.homeTeam} vs {m.awayTeam}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        {feed.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No events match these filters.</p>
        ) : (
          feed.map((entry) => {
            const manager = getManagerById(data, entry.managerId);
            const asset = entry.assetId ? getAssetById(data, entry.assetId) : undefined;
            const match = entry.matchId ? data.matches.find((m) => m.id === entry.matchId) : undefined;
            return (
              <EventFeedItem
                key={entry.id}
                entry={entry}
                manager={manager}
                asset={asset}
                matchLabel={match ? `${match.homeTeam} vs ${match.awayTeam}` : undefined}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
