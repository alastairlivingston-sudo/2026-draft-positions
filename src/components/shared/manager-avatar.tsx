import { cn } from "@/lib/utils";
import type { Manager } from "@/lib/types";

const SIZE_CLASSES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
} as const;

interface ManagerAvatarProps {
  manager: Pick<Manager, "initials" | "color" | "name">;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

export function ManagerAvatar({ manager, size = "md", className }: ManagerAvatarProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-extrabold text-background shadow-md ring-2 ring-white/10",
        SIZE_CLASSES[size],
        className,
      )}
      style={{
        background: `linear-gradient(135deg, ${manager.color}, ${manager.color}99)`,
      }}
      title={manager.name}
    >
      {manager.initials}
    </div>
  );
}
