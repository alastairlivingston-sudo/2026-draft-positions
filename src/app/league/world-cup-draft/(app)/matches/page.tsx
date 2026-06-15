import { MatchesView } from "@/components/matches/matches-view";

export default function MatchesPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Match Centre</h1>
        <p className="text-sm text-muted-foreground">
          Group stage fixtures, live scores and the fantasy assets riding on each one
        </p>
      </div>
      <MatchesView />
    </div>
  );
}
