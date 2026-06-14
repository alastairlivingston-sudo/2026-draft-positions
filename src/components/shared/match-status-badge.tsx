import { cn } from "@/lib/utils";
import type { MatchStatus } from "@/lib/types";

interface MatchStatusBadgeProps {
  status: MatchStatus;
  minute?: number | null;
  className?: string;
}

export function MatchStatusBadge({ status, minute, className }: MatchStatusBadgeProps) {
  if (status === "live") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-bold text-destructive",
          className,
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
        </span>
        {minute ? `${minute}'` : "LIVE"}
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span className={cn("inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground", className)}>
        Full time
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center rounded-full bg-sky-400/15 px-2.5 py-1 text-xs font-semibold text-sky-300", className)}>
      Upcoming
    </span>
  );
}
