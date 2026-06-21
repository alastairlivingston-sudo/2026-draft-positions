# Fantasy Draft Draw — Standalone Build Instructions

Paste this entire file as the first message in the new Claude Code session
(in the new, empty repo). It is self-contained: real fixture data, the
exact logic to implement, and the exact pages to build. No access to any
other repo is required.

## What this app is

A public, no-login web app where 12 people check their **draft pick order**
for a different fantasy league. Each person was assigned one 2026 FIFA
World Cup group. Draft order is determined by:

1. **Primary**: total goals scored across all group-stage matches in their
   assigned group (every goal by either team in every match in that group
   counts). Most goals = pick 1, next most = pick 2, etc.
2. **Tiebreak**: if two groups have the same total, whichever tied group
   had the **earliest-minute goal** scored anywhere in its group stage
   gets the earlier pick.

Title the app **"Fantasy Draft Draw"**.

## Participants (seed data — hardcode this)

| Name | Group | Countries (display only — the group is what's scored) |
|---|---|---|
| Josh Bye | L | England, Croatia, Ghana, Panama |
| Josh Gaon | J | Argentina, Algeria, Austria, Jordan |
| Ally | I | France, Senegal, Norway, Iraq |
| Liam | F | Netherlands, Japan, Sweden, Tunisia |
| Sac | H | Spain, Uruguay, Saudi Arabia, Cape Verde |
| Michael | G | Belgium, Egypt, Iran, New Zealand |
| Oli | E | Germany, Ivory Coast, Ecuador, Curaçao |
| Adam | C | Brazil, Morocco, Scotland, Haiti |
| Nathan | K | Portugal, Colombia, DR Congo, Uzbekistan |
| Josh Daniels | D | USA, Paraguay, Australia, Turkey |
| Myer | A | Mexico, South Africa, South Korea, Czech Republic |
| Conor | B | Switzerland, Bosnia, Canada, Qatar |

Note: a participant's score is the **sum for their whole group**, not their
4 countries individually weighted — the 4 countries listed *are* the
group's 4 teams, shown for display/flavour only.

## Fixture data (seed data — hardcode this, verified real World Cup 2026 schedule)

Seed every match below with `status: "upcoming"`, `homeScore: null`,
`awayScore: null`. Do **not** hand-enter results — the live ESPN sync
(below) backfills real scores and goal events automatically after deploy,
which is more reliable than transcribing scores by hand. Country name
spellings below match ESPN's naming exactly (`Czechia` not "Czech
Republic", `Türkiye` not "Turkey", `Curacao` not "Curaçao", `Korea` not
"South Korea", `Bosnia-Herzegovina` not "Bosnia") — use these exact
strings for ESPN team-name matching to work; map back to the prettier
display names from the participants table above purely in the UI layer.

```
Group A
  MD1: Mexico vs South Africa | 2026-06-11T19:00:00Z | Estadio Banorte, Mexico City
  MD1: Korea vs Czechia | 2026-06-12T02:00:00Z | Estadio Akron, Guadalajara
  MD2: Czechia vs South Africa | 2026-06-18T16:00:00Z | Mercedes-Benz Stadium, Atlanta, Georgia
  MD2: Mexico vs Korea | 2026-06-19T01:00:00Z | Estadio Akron, Guadalajara
  MD3: Czechia vs Mexico | 2026-06-25T01:00:00Z | Estadio Banorte, Mexico City
  MD3: South Africa vs Korea | 2026-06-25T01:00:00Z | Estadio BBVA, Guadalupe

Group B
  MD1: Canada vs Bosnia-Herzegovina | 2026-06-12T19:00:00Z | BMO Field, Toronto
  MD1: Qatar vs Switzerland | 2026-06-13T19:00:00Z | Levi's Stadium, Santa Clara, California
  MD2: Switzerland vs Bosnia-Herzegovina | 2026-06-18T19:00:00Z | SoFi Stadium, Inglewood, California
  MD2: Canada vs Qatar | 2026-06-18T22:00:00Z | BC Place, Vancouver
  MD3: Bosnia-Herzegovina vs Qatar | 2026-06-24T19:00:00Z | Lumen Field, Seattle, Washington
  MD3: Switzerland vs Canada | 2026-06-24T19:00:00Z | BC Place, Vancouver

Group C
  MD1: Brazil vs Morocco | 2026-06-13T22:00:00Z | MetLife Stadium, East Rutherford, New Jersey
  MD1: Haiti vs Scotland | 2026-06-14T01:00:00Z | Gillette Stadium, Foxborough, Massachusetts
  MD2: Scotland vs Morocco | 2026-06-19T22:00:00Z | Gillette Stadium, Foxborough, Massachusetts
  MD2: Brazil vs Haiti | 2026-06-20T00:30:00Z | Lincoln Financial Field, Philadelphia, Pennsylvania
  MD3: Morocco vs Haiti | 2026-06-24T22:00:00Z | Mercedes-Benz Stadium, Atlanta, Georgia
  MD3: Scotland vs Brazil | 2026-06-24T22:00:00Z | Hard Rock Stadium, Miami Gardens, Florida

Group D
  MD1: USA vs Paraguay | 2026-06-13T01:00:00Z | SoFi Stadium, Inglewood, California
  MD1: Australia vs Türkiye | 2026-06-14T04:00:00Z | BC Place, Vancouver
  MD2: USA vs Australia | 2026-06-19T19:00:00Z | Lumen Field, Seattle, Washington
  MD2: Türkiye vs Paraguay | 2026-06-20T03:00:00Z | Levi's Stadium, Santa Clara, California
  MD3: Paraguay vs Australia | 2026-06-26T02:00:00Z | Levi's Stadium, Santa Clara, California
  MD3: Türkiye vs USA | 2026-06-26T02:00:00Z | SoFi Stadium, Inglewood, California

Group E
  MD1: Germany vs Curacao | 2026-06-14T17:00:00Z | NRG Stadium, Houston, Texas
  MD1: Ivory Coast vs Ecuador | 2026-06-14T23:00:00Z | Lincoln Financial Field, Philadelphia, Pennsylvania
  MD2: Germany vs Ivory Coast | 2026-06-20T20:00:00Z | BMO Field, Toronto
  MD2: Ecuador vs Curacao | 2026-06-21T00:00:00Z | GEHA Field at Arrowhead Stadium, Kansas City, Missouri
  MD3: Curacao vs Ivory Coast | 2026-06-25T20:00:00Z | Lincoln Financial Field, Philadelphia, Pennsylvania
  MD3: Ecuador vs Germany | 2026-06-25T20:00:00Z | MetLife Stadium, East Rutherford, New Jersey

Group F
  MD1: Netherlands vs Japan | 2026-06-14T20:00:00Z | AT&T Stadium, Arlington, Texas
  MD1: Sweden vs Tunisia | 2026-06-15T02:00:00Z | Estadio BBVA, Guadalupe
  MD2: Netherlands vs Sweden | 2026-06-20T17:00:00Z | NRG Stadium, Houston, Texas
  MD2: Tunisia vs Japan | 2026-06-21T04:00:00Z | Estadio BBVA, Guadalupe
  MD3: Japan vs Sweden | 2026-06-25T23:00:00Z | AT&T Stadium, Arlington, Texas
  MD3: Tunisia vs Netherlands | 2026-06-25T23:00:00Z | GEHA Field at Arrowhead Stadium, Kansas City, Missouri

Group G
  MD1: Belgium vs Egypt | 2026-06-15T19:00:00Z | Lumen Field, Seattle, Washington
  MD1: Iran vs New Zealand | 2026-06-16T01:00:00Z | SoFi Stadium, Inglewood, California
  MD2: Belgium vs Iran | 2026-06-21T19:00:00Z | SoFi Stadium, Inglewood, California
  MD2: New Zealand vs Egypt | 2026-06-22T01:00:00Z | BC Place, Vancouver
  MD3: Egypt vs Iran | 2026-06-27T03:00:00Z | Lumen Field, Seattle, Washington
  MD3: New Zealand vs Belgium | 2026-06-27T03:00:00Z | BC Place, Vancouver

Group H
  MD1: Spain vs Cape Verde | 2026-06-15T16:00:00Z | Mercedes-Benz Stadium, Atlanta, Georgia
  MD1: Saudi Arabia vs Uruguay | 2026-06-15T22:00:00Z | Hard Rock Stadium, Miami Gardens, Florida
  MD2: Spain vs Saudi Arabia | 2026-06-21T16:00:00Z | Mercedes-Benz Stadium, Atlanta, Georgia
  MD2: Uruguay vs Cape Verde | 2026-06-21T22:00:00Z | Hard Rock Stadium, Miami Gardens, Florida
  MD3: Cape Verde vs Saudi Arabia | 2026-06-27T00:00:00Z | NRG Stadium, Houston, Texas
  MD3: Uruguay vs Spain | 2026-06-27T00:00:00Z | Estadio Akron, Guadalajara

Group I
  MD1: France vs Senegal | 2026-06-16T19:00:00Z | MetLife Stadium, East Rutherford, New Jersey
  MD1: Iraq vs Norway | 2026-06-16T22:00:00Z | Gillette Stadium, Foxborough, Massachusetts
  MD2: France vs Iraq | 2026-06-22T21:00:00Z | Lincoln Financial Field, Philadelphia, Pennsylvania
  MD2: Norway vs Senegal | 2026-06-23T00:00:00Z | MetLife Stadium, East Rutherford, New Jersey
  MD3: Norway vs France | 2026-06-26T19:00:00Z | Gillette Stadium, Foxborough, Massachusetts
  MD3: Senegal vs Iraq | 2026-06-26T19:00:00Z | BMO Field, Toronto

Group J
  MD1: Argentina vs Algeria | 2026-06-17T01:00:00Z | GEHA Field at Arrowhead Stadium, Kansas City, Missouri
  MD1: Austria vs Jordan | 2026-06-17T04:00:00Z | Levi's Stadium, Santa Clara, California
  MD2: Argentina vs Austria | 2026-06-22T17:00:00Z | AT&T Stadium, Arlington, Texas
  MD2: Jordan vs Algeria | 2026-06-23T03:00:00Z | Levi's Stadium, Santa Clara, California
  MD3: Algeria vs Austria | 2026-06-28T02:00:00Z | GEHA Field at Arrowhead Stadium, Kansas City, Missouri
  MD3: Jordan vs Argentina | 2026-06-28T02:00:00Z | AT&T Stadium, Arlington, Texas

Group K
  MD1: Portugal vs DR Congo | 2026-06-17T17:00:00Z | NRG Stadium, Houston, Texas
  MD1: Uzbekistan vs Colombia | 2026-06-18T02:00:00Z | Estadio Azteca, Mexico City
  MD2: Portugal vs Uzbekistan | 2026-06-23T17:00:00Z | NRG Stadium, Houston, Texas
  MD2: Colombia vs DR Congo | 2026-06-24T02:00:00Z | Estadio Akron, Guadalajara
  MD3: Colombia vs Portugal | 2026-06-27T23:30:00Z | Hard Rock Stadium, Miami Gardens, Florida
  MD3: DR Congo vs Uzbekistan | 2026-06-27T23:30:00Z | Mercedes-Benz Stadium, Atlanta, Georgia

Group L
  MD1: England vs Croatia | 2026-06-17T20:00:00Z | AT&T Stadium, Arlington, Texas
  MD1: Ghana vs Panama | 2026-06-17T23:00:00Z | BMO Field, Toronto
  MD2: England vs Ghana | 2026-06-23T20:00:00Z | Gillette Stadium, Foxborough, Massachusetts
  MD2: Panama vs Croatia | 2026-06-23T23:00:00Z | BMO Field, Toronto
  MD3: Croatia vs Ghana | 2026-06-27T21:00:00Z | Lincoln Financial Field, Philadelphia, Pennsylvania
  MD3: Panama vs England | 2026-06-27T21:00:00Z | MetLife Stadium, East Rutherford, New Jersey
```

72 matches total, 6 per group × 12 groups. (Group K's fixtures, sourced
separately from ESPN's own schedule since they weren't needed by any
prior project — verified via web search, June 2026.)

## Tech stack

Next.js (App Router, TypeScript), Tailwind CSS v4, shadcn/ui, Zustand
(`persist` middleware to localStorage as the MVP "database" — no backend
needed), Vitest for unit tests. Scaffold fresh with `create-next-app`;
this is a brand-new codebase, not a copy of any other project's git
history.

## Domain model

```ts
type Participant = { id: string; name: string; group: string; countries: string[] };

type GroupMatch = {
  id: string;            // e.g. "a1", "a2", ... "k1", "k2" — group letter + index
  group: string;         // "A".."L"
  matchday: 1 | 2 | 3;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;       // ISO 8601
  venue: string;
  status: "upcoming" | "live" | "completed";
  homeScore: number | null;
  awayScore: number | null;
  minute: number | null;
  locked: boolean;       // admin can lock to freeze a match against further sync
};

type GoalEvent = {
  id: string;
  matchId: string;
  group: string;
  team: string;          // scoring team's name
  minute: number;        // use 90+x as e.g. 91 for a 90+1' goal, 46 for 45+1' etc — just total elapsed minutes, integer
  ownGoal?: boolean;      // still counts toward the team that benefits (own goals count for the conceding side's opponent's total — i.e. credit the goal to whichever side it should be added to per official rules)
  source: "api" | "manual";
};
```

Own-goal handling: an own goal increases the *scoring team's opponent's*
tally in the actual match score (that's just how `homeScore`/`awayScore`
already work), so for the group total it's already counted correctly via
the match score — you don't need to special-case it in `GoalEvent` totals,
only `GroupMatch.homeScore + awayScore` matters for the goal-total ranking.
`GoalEvent.team` for an own goal should record which team's *total* the
goal counts toward (i.e. the team that benefits), so the fastest-goal
tiebreak logic doesn't need to know about own goals either — every
`GoalEvent` already represents "a goal added to this team's column."

## Core logic — pure functions, fully unit tested

```ts
function getGroupGoalTotal(group: string, matches: GroupMatch[]): number
// sum of (homeScore ?? 0) + (awayScore ?? 0) across all matches in `group`

function getGroupFastestGoalMinute(group: string, goalEvents: GoalEvent[]): number
// min(minute) across all GoalEvents in `group`; return Infinity if none yet

function getDraftOrder(
  participants: Participant[],
  matches: GroupMatch[],
  goalEvents: GoalEvent[],
): { participant: Participant; pick: number; goals: number; fastestGoalMinute: number; stillTied: boolean }[]
// sort descending by goals; ties broken by ascending fastestGoalMinute;
// if still tied (e.g. both groups have 0 goals so far), mark stillTied: true
// and give them the same provisional pick number — don't fabricate a fake
// order when there's genuinely no signal yet.
```

Write Vitest tests for all three, covering: a clear goals-based ranking, a
tie broken correctly by fastest goal, and the "nobody's scored yet"
all-zero case.

## Live data sync (the ESPN integration)

Reuse the *technique*, not any hardcoded fixture-ID map (a fixture-ID map
was a shortcut a prior project used because it only cared about ~22 of the
66 group-stage matches; this app cares about **all 72**, across a brand
new Group K with no prior mapping, so don't hardcode IDs — match by date +
team name instead, which generalizes automatically):

1. **Resolve each match to ESPN's event id at request time**, not via a
   static map. Call ESPN's public scoreboard endpoint for the tournament's
   date range:
   `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260720`
   For each event in the response, extract the two competing team names
   and the date, normalize them (strip diacritics, lowercase, trim — e.g.
   "Türkiye" → "turkiye", "Côte d'Ivoire"/"Ivory Coast" → handle both
   spellings), and match against your seeded `GroupMatch.homeTeam`/
   `awayTeam` (also normalized) plus a same-day kickoff check. This is the
   one-time-per-poll lookup; cache the scoreboard response per poll cycle
   so you're not refetching it once per match.
2. For each matched event, pull `status`, `homeScore`/`awayScore` (or
   from the competitor scores in the scoreboard payload directly — the
   scoreboard response already includes scores, so you likely don't even
   need the `/summary?event=` endpoint just for scores).
3. For **goal events and minutes** (needed for the tiebreak), call
   `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event={id}`
   for any match that's `live` or has just gone `completed`, and read its
   `keyEvents` array, filtering for goal-type entries (including own
   goals — ESPN tags these distinctly; attribute the `GoalEvent.team` to
   whichever team the goal should count for per the own-goal handling
   note above) with their `clock`/minute. Dedupe on
   `matchId:team:minute` (a coarser hash than the original fantasy app
   used, since there's no per-player identity here to disambiguate
   against).
4. Wrap all of this in a Next.js `/api/live` route using `unstable_cache`
   (e.g. 1 hour revalidate, configurable via an env var), exactly like the
   shared-poll-cache pattern: one upstream ESPN call serves every browser
   polling the route, regardless of visitor count.
5. A `useLivePolling` hook polls `/api/live` (e.g. every 60s, configurable),
   calling store actions to merge in match status/scores and append new
   goal events.

No mock-data mode is needed here (unlike a fantasy-points app with a
"works with zero config" requirement) — this app's only job is showing
real World Cup standings, so requiring the live ESPN call from the start
is fine. If ESPN's API is unreachable, the `/api/live` route should fail
soft (return last-known cached state / empty diffs), never crash the page.

## Pages

- **`/` (leaderboard)** — public, no login, the only page that matters.
  Ranked list: pick #, participant name, group letter, the group's 4
  countries (small/secondary text), total goals, fastest goal (e.g. "12'"
  with which match it was), matches remaining in their group ("3 of 6
  played"). Highlight ties visually if `stillTied`.
- **`/rules`** — plain explanation of the format: each person owns a
  group, total group goals decide draft order, ties broken by the
  earliest goal scored in either tied group.
- **`/admin`** — no auth (link-only, matching this style of low-stakes
  friend-league app): manual match-result/goal correction for when ESPN
  data is late or wrong, lock/unlock individual matches against further
  sync, a simple audit log of manual edits. Skip if you want a faster v1
  — it's not needed for the public leaderboard to work, only for handling
  ESPN data gaps gracefully.
- **Cast mode / sharing (QR code, copy link, WhatsApp share button)** —
  nice-to-have, not required for v1. Add only if there's time; the
  leaderboard page alone satisfies "people can check league positions."

## Testing

```bash
npm run test    # vitest — the three pure functions above, plus dedup logic
npm run lint
npx tsc --noEmit
npm run build
```

## Deployment

1. Push the initial commit to this repo's default branch.
2. Create a new Vercel project linked to this repo (no env vars required
   to start — only add a cache-duration override later if needed).
3. Confirm the production deployment reaches `READY`.
4. Smoke-check: leaderboard loads, shows all 12 participants, and after
   the first `/api/live` poll completes, goal totals reflect matches
   already played (several groups will already have results in by the
   time this is built, since today is 2026-06-21 and most groups have
   played 1-2 of their 3 matchdays).
5. Report the live URL back to the user.
