import { Minus } from "lucide-react";

import { cn } from "@/lib/utils";

interface RankChangeProps {
  rankChange: number;
  className?: string;
}

/** Smooth rank movement indicator: green up arrow, red down arrow, or a dash. */
export function RankChange({ rankChange, className }: RankChangeProps) {
  if (rankChange === 0) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground", className)}>
        <Minus className="h-3.5 w-3.5" />
      </span>
    );
  }

  const isUp = rankChange > 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-bold tabular-nums",
        isUp ? "text-primary" : "text-destructive",
        className,
      )}
    >
      <svg viewBox="0 0 12 12" className={cn("h-3 w-3 fill-current", !isUp && "rotate-180")} aria-hidden="true">
        <path d="M6 1.5 L11 8.5 H1 Z" />
      </svg>
      {Math.abs(rankChange)}
    </span>
  );
}
