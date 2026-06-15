import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

import { EVENT_LABELS, EventIcon } from "@/components/shared/event-icon";
import { PointsPill } from "@/components/shared/points-pill";
import type { Manager, SquadAsset } from "@/lib/types";
import type { FeedEntry } from "@/lib/selectors";

interface EventFeedItemProps {
  entry: FeedEntry;
  manager?: Manager;
  asset?: SquadAsset;
  matchLabel?: string;
  linkToManager?: boolean;
}

export function EventFeedItem({ entry, manager, asset, matchLabel, linkToManager = true }: EventFeedItemProps) {
  const title = asset?.name ?? manager?.name ?? "Manual adjustment";
  const label = EVENT_LABELS[entry.type] ?? entry.type;

  const content = (
    <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-3 transition-colors hover:border-primary/30">
      <EventIcon type={entry.type} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-bold">{title}</span>
          <PointsPill points={entry.points} size="sm" />
        </div>
        <div className="text-xs text-muted-foreground">
          {label}
          {entry.minute !== null ? ` · ${entry.minute}'` : ""}
          {manager ? ` · ${manager.name}` : ""}
        </div>
        {entry.detail ? <p className="truncate text-xs text-muted-foreground/80">{entry.detail}</p> : null}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground/70">
          <span>{matchLabel ?? ""}</span>
          <span>{formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}</span>
        </div>
      </div>
    </div>
  );

  if (linkToManager && manager) {
    return <Link href={`/league/world-cup-draft/manager/${manager.id}`}>{content}</Link>;
  }

  return content;
}
