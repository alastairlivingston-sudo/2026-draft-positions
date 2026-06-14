import {
  Flame,
  Hand,
  RectangleVertical,
  RotateCcw,
  Send,
  Settings2,
  Shield,
  ShieldAlert,
  Target,
  ThumbsDown,
  Trophy,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { FantasyEventType } from "@/lib/types";

type EventKind = FantasyEventType | "manual_adjustment";

const EVENT_ICONS: Record<EventKind, typeof Target> = {
  goal: Target,
  assist: Send,
  yellow_card: RectangleVertical,
  red_card: RectangleVertical,
  own_goal: RotateCcw,
  penalty_saved: Hand,
  penalty_missed: XCircle,
  clean_sheet: Shield,
  team_win: Trophy,
  team_loss: ThumbsDown,
  team_scored_3plus: Flame,
  team_conceded_3plus: ShieldAlert,
  manual_adjustment: Settings2,
};

const EVENT_STYLES: Record<EventKind, string> = {
  goal: "bg-primary/15 text-primary",
  assist: "bg-sky-400/15 text-sky-300",
  yellow_card: "bg-amber-400/15 text-amber-300",
  red_card: "bg-destructive/15 text-destructive",
  own_goal: "bg-destructive/15 text-destructive",
  penalty_saved: "bg-primary/15 text-primary",
  penalty_missed: "bg-destructive/15 text-destructive",
  clean_sheet: "bg-cyan-400/15 text-cyan-300",
  team_win: "bg-primary/15 text-primary",
  team_loss: "bg-destructive/15 text-destructive",
  team_scored_3plus: "bg-orange-400/15 text-orange-300",
  team_conceded_3plus: "bg-destructive/15 text-destructive",
  manual_adjustment: "bg-accent/15 text-accent",
};

export const EVENT_LABELS: Record<EventKind, string> = {
  goal: "Goal",
  assist: "Assist",
  yellow_card: "Yellow card",
  red_card: "Red card",
  own_goal: "Own goal",
  penalty_saved: "Penalty saved",
  penalty_missed: "Penalty missed",
  clean_sheet: "Clean sheet",
  team_win: "Team win",
  team_loss: "Team loss",
  team_scored_3plus: "Scored 3+",
  team_conceded_3plus: "Conceded 3+",
  manual_adjustment: "Manual adjustment",
};

interface EventIconProps {
  type: EventKind;
  className?: string;
}

export function EventIcon({ type, className }: EventIconProps) {
  const Icon = EVENT_ICONS[type] ?? Settings2;
  return (
    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", EVENT_STYLES[type], className)}>
      <Icon className={cn("h-4 w-4", type === "yellow_card" && "fill-amber-300", type === "red_card" && "fill-destructive")} />
    </span>
  );
}
