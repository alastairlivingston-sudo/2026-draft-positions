import { cn } from "@/lib/utils";
import type { Position } from "@/lib/types";

const POSITION_STYLES: Record<Position, string> = {
  Goalkeeper: "bg-amber-400/15 text-amber-300 border-amber-400/30",
  Defender: "bg-sky-400/15 text-sky-300 border-sky-400/30",
  Midfielder: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  Striker: "bg-rose-400/15 text-rose-300 border-rose-400/30",
  Team: "bg-violet-400/15 text-violet-300 border-violet-400/30",
};

const POSITION_ABBR: Record<Position, string> = {
  Goalkeeper: "GK",
  Defender: "DEF",
  Midfielder: "MID",
  Striker: "FWD",
  Team: "TEAM",
};

interface PositionChipProps {
  position: Position;
  className?: string;
  abbreviate?: boolean;
}

export function PositionChip({ position, className, abbreviate = true }: PositionChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase",
        POSITION_STYLES[position],
        className,
      )}
    >
      {abbreviate ? POSITION_ABBR[position] : position}
    </span>
  );
}
