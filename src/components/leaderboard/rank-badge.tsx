import { cn } from "@/lib/utils";

const RANK_STYLES: Record<number, string> = {
  1: "bg-gradient-to-br from-yellow-300 to-amber-500 text-amber-950 shadow-lg shadow-amber-500/30 ring-2 ring-amber-300/50",
  2: "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900 shadow-md shadow-slate-400/20",
  3: "bg-gradient-to-br from-orange-300 to-orange-500 text-orange-950 shadow-md shadow-orange-500/20",
};

interface RankBadgeProps {
  rank: number;
  className?: string;
}

export function RankBadge({ rank, className }: RankBadgeProps) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-base font-black",
        RANK_STYLES[rank] ?? "bg-muted text-foreground",
        className,
      )}
    >
      {rank}
    </div>
  );
}
