import { cn } from "@/lib/utils";

interface PointsPillProps {
  points: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: "text-xs px-1.5 py-0.5",
  md: "text-sm px-2 py-0.5",
  lg: "text-base px-2.5 py-1",
};

export function PointsPill({ points, className, size = "md" }: PointsPillProps) {
  const isPositive = points > 0;
  const isNegative = points < 0;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-bold tabular-nums",
        SIZE_CLASSES[size],
        isPositive && "bg-primary/15 text-primary",
        isNegative && "bg-destructive/15 text-destructive",
        !isPositive && !isNegative && "bg-muted text-muted-foreground",
        className,
      )}
    >
      {points > 0 ? `+${points}` : points}
    </span>
  );
}
