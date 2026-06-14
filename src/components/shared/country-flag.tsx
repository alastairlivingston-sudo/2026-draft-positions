import { flagEmoji } from "@/lib/flags";
import { cn } from "@/lib/utils";

interface CountryFlagProps {
  countryCode: string;
  className?: string;
}

export function CountryFlag({ countryCode, className }: CountryFlagProps) {
  return (
    <span className={cn("text-lg leading-none", className)} role="img" aria-hidden="true">
      {flagEmoji(countryCode)}
    </span>
  );
}
