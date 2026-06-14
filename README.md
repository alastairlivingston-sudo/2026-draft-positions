# World Cup Draft - Fantasy League Tracker

A mobile-first fantasy World Cup points tracker for a private 8-manager
league. Friends get a shareable public link to follow the live
leaderboard, squads, matches and event feed; the league admin gets a
password-protected dashboard to manage scoring.

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
  history), lock/unlock matches, and a full audit log.
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

Visit `/league/world-cup-draft/admin` and sign in with the admin
password (default `worldcup2026`, or whatever you set as
`ADMIN_PASSWORD`). This sets an httpOnly session cookie.

## Environment variables

Copy `.env.example` to `.env.local` and adjust as needed - everything
has a working default:

| Variable | Default | Purpose |
| --- | --- | --- |
| `ADMIN_PASSWORD` | `worldcup2026` | Password for `/league/world-cup-draft/admin`. |
| `NEXT_PUBLIC_USE_MOCK_DATA` | `true` | Set to `false` to use the API-Football provider instead of mock live events. |
| `API_FOOTBALL_KEY` | _(none)_ | API key for [API-Football](https://www.api-football.com/), used server-side by `src/app/api/live/route.ts`. |
| `LIVE_DATA_CACHE_SECONDS` | `3600` | How long `/api/live` caches the upstream provider response, shared across all clients. Keeps API-Football usage to ~24/(hours) requests/day regardless of how many browsers are open. |
| `NEXT_PUBLIC_LIVE_POLL_INTERVAL_MS` | `60000` | How often the browser polls `/api/live`, in ms. Only affects UI freshness - the upstream call is cached per `LIVE_DATA_CACHE_SECONDS` above. |
| `NEXT_PUBLIC_SUPABASE_URL` | _(none)_ | For a future Supabase-backed store (see `supabase/schema.sql`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | _(none)_ | Same as above. |

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
        admin/                # admin dashboard (password gated)
      cast/                  # full-screen cast mode (no nav)
      layout.tsx             # live-polling provider
    api/admin/login|logout/  # admin session cookie endpoints
    api/live/route.ts       # cached live-data endpoint (see "Live data")
  components/
    leaderboard/, events/, matches/, squad/, admin/, shared/, ui/
  lib/
    types.ts                 # core domain types
    scoring.ts                # scoring engine (pure functions)
    selectors.ts              # derived state (leaderboard, feeds, etc.)
    store/league-store.ts     # Zustand store + admin actions + audit log
    data/seed.ts              # seed managers, squads, matches, events
    data/api-football-mapping.ts  # fixture/player ID map for live API mode
    api/                       # mock + API-Football provider adapters
    hooks/use-live-polling.ts  # polls match status + live events
    auth.ts                    # admin password/session helpers
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
   needed for these.
2. `events` - new player events (goals, assists, cards, own goals,
   missed penalties) for any live match, ingested via
   `ingestApiEvents`, which dedupes on `fixtureId:assetId:minute:type:detail`.

- **Mock mode (default)**: `src/lib/api/mock-provider.ts` reveals a
  scripted set of events for the live match (`m4`, Spain vs Ivory
  Coast) over time, so you can see the leaderboard update live.
- **API-Football mode**: set `NEXT_PUBLIC_USE_MOCK_DATA=false` and
  `API_FOOTBALL_KEY` (server-side env vars only - never expose this key
  to the browser). `src/lib/api/api-football-provider.ts` calls
  API-Football's `/fixtures` and `/fixtures/events` endpoints for the
  fixtures/players listed in `src/lib/data/api-football-mapping.ts` -
  fill that file in with your World Cup 2026 fixture IDs and your
  squads' player IDs (instructions are in the file's header comment).
  Until it has entries, the app behaves as if running in mock mode.
  Note: penalty saves aren't reported as a distinct API-Football event
  and still need to be logged manually from the admin dashboard.

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
3. Add the environment variables above (at minimum, set
   `ADMIN_PASSWORD` to something private).
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
- **Admin auth is a single shared password**, not per-user accounts.
  `src/lib/auth.ts` is structured so it can be swapped for Supabase
  Auth + a role check without changing call sites.
- **API-Football integration needs ID mapping.** The provider is fully
  implemented (`src/lib/api/api-football-provider.ts`), but
  `src/lib/data/api-football-mapping.ts` ships empty - fixtures and
  players won't resolve until you fill in those IDs. Penalty saves
  also have no API event and need manual entry either way.
- **Free-tier rate limits are tight.** API-Football's free plan allows
  100 requests/day; `NEXT_PUBLIC_LIVE_POLL_INTERVAL_MS` should be set
  high enough (e.g. 10 min) to stay under that across a full match day.

## Suggested next improvements

- Wire up `supabase/schema.sql` and replace the Zustand store with
  Supabase reads + server actions, so all viewers share live state.
- Fill in `src/lib/data/api-football-mapping.ts` with real fixture and
  player IDs for your league's squads.
- Add Supabase Auth for admin login and per-action audit identities.
- Add push notifications / toasts for live scoring events.
- Add a draft/squad-editing flow for future seasons.
