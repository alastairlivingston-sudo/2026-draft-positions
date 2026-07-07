# World Cup Draft - Fantasy League Tracker

A mobile-first fantasy World Cup points tracker for a private 8-manager
league. Friends get a shareable public link to follow the live
leaderboard, squads, matches and event feed; the league admin gets a
dashboard to manage scoring.

Built with Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui and
Zustand. Ships with mocked seed data so it works immediately, with a
clean adapter layer ready to swap in a live football API and Supabase.

## Features

- **Public leaderboard** - rank, total points, today's change, rank
  movement, best asset and "still to play" count per manager.
- **Manager squad pages** - all 8 squad assets per manager with live
  points and a per-asset event breakdown.
- **Match Centre** - live/upcoming/completed fixtures, the fantasy
  assets riding on each one, and admin lock/unlock controls.
- **Event feed** - chronological log of every fantasy point awarded,
  filterable by manager and match.
- **Rules page** - the current scoring values, explained.
- **Admin dashboard** - add/edit/delete fantasy events, manual point
  adjustments, edit scoring rules (apply going forward or recalculate
  history), lock/unlock matches, edit the squad-asset mapping, and a
  full audit log.
- **Cast mode** - a full-screen scoreboard for a TV or projector.
- **Sharing** - copy invite link, WhatsApp share, and a QR code.
- **PWA-friendly** - installable with a manifest and app icon.

## Tech stack

- Next.js 16 (App Router, Turbopack, React 19)
- TypeScript, Tailwind CSS v4, shadcn/ui (base-ui)
- Zustand (`persist` to localStorage) as the MVP "database"
- Vitest for unit tests

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000> - it redirects to `/league/world-cup-draft`.

The app works immediately with no environment variables or backend:
all league data (managers, squads, matches, events, scoring rules,
audit log) ships as seed data in `src/lib/data/seed.ts` and is persisted
to `localStorage` via the Zustand store in `src/lib/store/league-store.ts`.

### Admin access

Visit `/league/world-cup-draft/admin` - the dashboard is open to anyone
with the link, with no separate login.

## Environment variables

Copy `.env.example` to `.env.local` and adjust as needed - everything
has a working default:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_USE_MOCK_DATA` | `false` | Live ESPN scores/events are the default. Set to `true` to use the scripted mock/seed data instead (local dev / demo). |
| `API_FOOTBALL_KEY` | _(none)_ | Optional legacy provider ([API-Football](https://www.api-football.com/)) - if set alongside `NEXT_PUBLIC_USE_MOCK_DATA=false`, used instead of the default ESPN provider. Its free tier doesn't cover the 2026 World Cup. |
| `LIVE_DATA_CACHE_SECONDS` | `3600` | How long `/api/live` caches the upstream provider response, shared across all clients, so the live provider is only hit once per cache window regardless of how many browsers are open. |
| `NEXT_PUBLIC_LIVE_POLL_INTERVAL_MS` | `60000` | How often the browser polls `/api/live`, in ms. Only affects UI freshness - the upstream call is cached per `LIVE_DATA_CACHE_SECONDS` above. |
| `NEXT_PUBLIC_SUPABASE_URL` | _(none)_ | Supabase project URL (see `supabase/schema.sql`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | _(none)_ | Supabase anon/public key - RLS restricts it to read-only. |
| `SUPABASE_SERVICE_ROLE_KEY` | _(none)_ | Supabase service-role key - server-only, used by the seed/ingest routes to bypass RLS for writes. Never expose to the client. |
| `NEXT_PUBLIC_USE_SUPABASE` | `false` | Master switch for the Supabase-backed store. Off by default so the existing localStorage/Zustand app keeps working until the migration reaches cutover. |
| `ADMIN_SECRET` | _(none)_ | Shared passphrase required (as an `x-admin-secret` header) to call `/api/admin/seed` and `/api/admin/refresh`. |
| `CRON_SECRET` | _(none)_ | Required by Vercel Cron to call `/api/cron/ingest` (sent as `Authorization: Bearer $CRON_SECRET`, per Vercel's convention). |

## Project structure

```
src/
  app/
    league/world-cup-draft/
      (app)/                # pages sharing the top bar + bottom nav
        page.tsx             # leaderboard
        manager/[id]/         # manager squad page
        matches/              # match centre
        events/               # event feed
        rules/                # scoring rules
        admin/                # admin dashboard
      cast/                  # full-screen cast mode (no nav)
      layout.tsx             # live-polling provider
    api/live/route.ts       # cached live-data endpoint (see "Live data")
    api/cron/ingest/route.ts     # scheduled Supabase ingest (see docs/supabase-migration.md)
    api/admin/seed/route.ts      # idempotent Supabase seed load
    api/admin/refresh/route.ts   # on-demand Supabase ingest trigger
  components/
    leaderboard/, events/, matches/, squad/, admin/, shared/, ui/
  lib/
    types.ts                 # core domain types
    scoring.ts                # scoring engine (pure functions)
    selectors.ts              # derived state (leaderboard, feeds, etc.)
    store/league-store.ts     # Zustand store + admin actions + audit log
    data/seed.ts              # seed managers, squads, matches, events
    data/espn-fixture-map.ts  # SEED_MATCHES id -> ESPN event id mapping
    data/api-football-mapping.ts  # legacy fixture/player ID map for API-Football mode
    api/                       # mock, ESPN and API-Football provider adapters
    hooks/use-live-polling.ts  # polls match status + live events
    supabase/                  # Supabase clients + row<->domain mappers (see docs/supabase-migration.md)
    server/                    # server-only helpers (admin auth, live-data ingest)
supabase/schema.sql          # Supabase schema for a future backend
```

## Scoring rules

Scoring values live in the store (`scoringValues`, editable from the
admin dashboard) and default to:

| Event | Points | Applies to |
| --- | --- | --- |
| Goal | +4 | Players |
| Assist | +2 | Players |
| Clean sheet | +2 | Goalkeepers / Defenders only |
| Penalty saved (incl. shootouts) | +4 | Players |
| Missed penalty (incl. shootouts) | -1 | Players |
| Yellow card | -1 | Players |
| Red card | -2 | Players |
| Own goal | -2 | Players |
| Team win | +1 | Team rows |
| Team scores 3+ | +1 | Team rows |
| Team loss | -1 | Team rows |
| Team concedes 3+ | -1 | Team rows |

Team bonuses never apply to player rows and player events never apply
to team rows - enforced in `src/lib/scoring.ts`.

## Live data

`src/lib/hooks/use-live-polling.ts` polls `/api/live`
(`src/app/api/live/route.ts`) every `NEXT_PUBLIC_LIVE_POLL_INTERVAL_MS`
(default 60s). That route calls the active provider and caches the
result for `LIVE_DATA_CACHE_SECONDS` (default 1 hour) via
`unstable_cache`, so the response is shared across every client - the
upstream provider is only hit once per cache window, no matter how many
browsers are polling.

On each response:

1. `matches` - refreshes status/score/minute for tracked matches via
   the `syncMatches` store action (locked matches are skipped). The
   first time a match flips to `completed`, `computeMatchResultEvents`
   (`src/lib/scoring.ts`) derives its clean-sheet and team
   win/loss/3+ bonus events from the final score - no ID mapping
   needed for these. Clean sheets are skipped for squad GK/Defenders
   who never appeared in the match at all, per
   `nonAppearingAssetIds` (see below).
2. `events` - new player events (goals, assists, cards, own goals,
   missed penalties) for any live match, ingested via
   `ingestApiEvents`, which dedupes on `fixtureId:assetId:minute:type:detail`.
3. `nonAppearingAssetIds` - for completed matches where a side kept a
   clean sheet, `EspnProvider.getNonAppearingAssetIds`
   (`src/lib/api/espn-provider.ts`) checks that side's ESPN roster and
   returns, **keyed per match id**, the squad GK/Defender asset ids who
   were neither a starter nor subbed on, so `computeMatchResultEvents`
   skips their clean sheet for that match only. The per-match keying
   matters: a defender can sit out one fixture (no clean sheet there) yet
   start and keep one in another, so the exclusion must never leak across
   matches. Players who appeared but came off before 60 minutes aren't
   covered by this check - an admin can remove their individual
   `clean_sheet` event from the Events tab if needed.

- **Mock mode (default)**: `src/lib/api/mock-provider.ts` reveals a
  scripted set of events for the live match (`m13`, Spain vs Cape
  Verde) over time, so you can see the leaderboard update live.
- **ESPN mode**: set `NEXT_PUBLIC_USE_MOCK_DATA=false`. No API key
  needed. `src/lib/api/espn-provider.ts` pulls real scores/events from
  ESPN's free public scoreboard for the fixtures listed in
  `src/lib/data/espn-fixture-map.ts` (Group Stage · Matchdays 1-3,
  `m1`-`m66`). Goals, assists, cards and own goals for squad players
  are matched by name against ESPN's `keyEvents` feed - no per-player ID
  mapping needed. Penalty saves aren't reported as a distinct event and
  still need to be logged manually from the admin dashboard.
- **Dynamic knockout fixtures**: Round of 32 onward can't be pre-mapped
  in `espn-fixture-map.ts` because the matchups depend on final group
  standings. Instead, `discoverDynamicMatches` (in `espn-provider.ts`)
  scans ESPN's scoreboard (now covering the whole tournament,
  `ESPN_SCOREBOARD_DATE_RANGE`) for any fixture not already in
  `ESPN_FIXTURE_ID_MAP` that involves a country picked by a squad, and
  `syncMatches` appends it to the league's matches automatically - it
  then gets the same live score/event syncing as every other fixture, no
  manual setup needed each round. This is purely additive and never
  changes how the validated `m1`-`m66` group-stage fixtures are synced.
- **Manual result correction**: the admin Matches tab has an "Edit
  result" button on every fixture, for use when a match isn't covered by
  the live provider yet or its data is wrong.
  Setting status/scores there and marking a match "Completed" awards
  clean sheet and team result bonuses immediately, via the same
  `computeMatchResultEvents` logic the live sync uses.
- **API-Football mode (legacy)**: set `NEXT_PUBLIC_USE_MOCK_DATA=false`
  and `API_FOOTBALL_KEY` (server-side env vars only - never expose this
  key to the browser). `src/lib/api/api-football-provider.ts` calls
  API-Football's `/fixtures` and `/fixtures/events` endpoints for the
  fixtures/players listed in `src/lib/data/api-football-mapping.ts` -
  fill that file in with your World Cup 2026 fixture IDs and your
  squads' player IDs (instructions are in the file's header comment).
  Note: API-Football's free tier doesn't cover the 2026 World Cup at
  all, so this mode only works on a paid plan.

## Testing

```bash
npm run test    # vitest
npm run lint    # eslint
npx tsc --noEmit
```

`src/lib/__tests__/scoring.test.ts` covers the full scoring matrix
(goals, assists, clean sheets by position, cards, penalties, team
bonuses, and the player/team isolation rules). `src/lib/__tests__/store.test.ts`
covers duplicate-event dedup, manual adjustments, scoring-rule
recalculation, and audit log entries.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import it into [Vercel](https://vercel.com/new).
3. Add the environment variables above if you want to change the defaults.
4. Deploy. The app is fully static/SSR-friendly and needs no database
   for the MVP.

Share `https://<your-app>.vercel.app/league/world-cup-draft` with your
league - the "Copy invite link", WhatsApp and QR code buttons on the
leaderboard page all point at that URL.

## Known limitations (MVP)

- **Data is per-browser.** The league store persists to `localStorage`,
  so admin edits made in one browser are not visible to other viewers
  until that browser's state is synced elsewhere. A Supabase-backed
  store (schema provided in `supabase/schema.sql`) is the natural next
  step for a shared, multi-device source of truth.
- **The admin dashboard has no login** - anyone with the link can edit
  scoring, events and the squad mapping. Add Supabase Auth + a role
  check if you need to restrict access.
- **Group Stage · Matchdays 1-3 (`m1`-`m66`) are statically mapped and
  validated** via `src/lib/data/espn-fixture-map.ts`. Knockout fixtures
  are picked up automatically by `discoverDynamicMatches` once ESPN's
  bracket shows real team names (after the group stage concludes) - no
  manual mapping needed, but a brand-new fixture only appears after its
  matchup is known. Until then, or if ESPN's data is wrong, use the
  admin Matches tab's "Edit result" button to enter results by hand.
  Penalty saves have no API event and need manual entry either way.
- **Dynamic discovery only recognises countries picked by a squad.** A
  knockout fixture between two non-squad countries is ignored entirely
  (no fantasy relevance); a fixture where only one side is squad-relevant
  is still added so that side's players/team score normally.
- **API-Football integration (legacy) needs ID mapping and a paid
  plan.** The provider is fully implemented
  (`src/lib/api/api-football-provider.ts`), but
  `src/lib/data/api-football-mapping.ts` ships empty, and its free tier
  doesn't cover the 2026 World Cup regardless.

## Suggested next improvements

- Wire up `supabase/schema.sql` and replace the Zustand store with
  Supabase reads + server actions, so all viewers share live state.
- Extend `src/lib/data/espn-fixture-map.ts` and `SEED_MATCHES` for
  Matchday 2+ as fixtures are confirmed.
- Add Supabase Auth for admin login and per-action audit identities.
- Add push notifications / toasts for live scoring events.
- Add a draft/squad-editing flow for future seasons.
