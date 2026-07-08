# World Cup Draft - Fantasy League Tracker

A mobile-first fantasy World Cup points tracker for a private 8-manager
league. Friends get a shareable public link to follow the live
leaderboard, squads, matches and event feed; the league admin gets a
dashboard to manage scoring.

Built with Next.js (App Router), TypeScript, Tailwind CSS and shadcn/ui,
backed by a shared Supabase Postgres database - every viewer's browser
reads the same live state, and a scheduled server-side job keeps it
in sync with ESPN.

## Features

- **Public leaderboard** - rank, total points, today's change, rank
  movement, best asset and "still to play" count per manager.
- **Manager squad pages** - all 8 squad assets per manager with live
  points and a per-asset event breakdown.
- **Match Centre** - live/upcoming/completed fixtures, the fantasy
  assets riding on each one, and lock/unlock controls.
- **Event feed** - chronological log of every fantasy point awarded,
  filterable by manager and match.
- **Rules page** - the current scoring values, explained.
- **Admin dashboard** (passphrase-gated) - add/edit/delete fantasy
  events, manual point adjustments, edit scoring rules (apply going
  forward or recalculate history), lock/unlock matches, edit the
  squad-asset mapping, trigger an on-demand data refresh, and a full
  audit log.
- **Cast mode** - a full-screen scoreboard for a TV or projector.
- **Sharing** - copy invite link, WhatsApp share, and a QR code.
- **PWA-friendly** - installable with a manifest and app icon.

## Tech stack

- Next.js 16 (App Router, Turbopack, React 19)
- TypeScript, Tailwind CSS v4, shadcn/ui (base-ui)
- Supabase Postgres as the shared source of truth, via a Vercel Cron
  job (`/api/cron/ingest`) that pulls ESPN server-side
- Zustand as an in-memory client read cache, hydrated by polling a
  Supabase snapshot endpoint (no localStorage persistence)
- Vitest for unit tests

## Getting started

1. Create a Supabase project (the [Vercel integration](https://vercel.com/integrations/supabase)
   provisions one and injects its env vars automatically; otherwise
   create one at [supabase.com](https://supabase.com) by hand).
2. Apply `supabase/schema.sql` via the Supabase SQL editor.
3. Copy `.env.example` to `.env.local` and fill in the Supabase URL/keys
   plus `ADMIN_SECRET` (see the table below).
4. Install and run:

   ```bash
   npm install
   npm run dev
   ```

5. Seed the database once - this loads the real league (managers,
   squads, match schedule, curated historical events) from
   `src/lib/data/seed.ts`:

   ```bash
   curl -X POST http://localhost:3000/api/admin/seed -H "x-admin-secret: $ADMIN_SECRET"
   ```

Open <http://localhost:3000> - it redirects to `/league/world-cup-draft`.
Every page reads from Supabase via a polling snapshot
(`src/lib/hooks/use-supabase-snapshot-polling.ts`), so any device hitting
the same Supabase project sees identical, live state.

### Admin access

Visit `/league/world-cup-draft/admin` and enter the passphrase set in
`ADMIN_SECRET` - it's checked once by `/api/admin/login`, which sets an
httpOnly session cookie for subsequent admin actions (see
`src/components/admin/admin-gate.tsx`).

### Keeping data fresh

`/api/cron/ingest` fetches ESPN, derives scoring events server-side, and
upserts everything into Supabase - scheduled every 5 minutes by a GitHub
Actions workflow (`.github/workflows/ingest-cron.yml`), not Vercel Cron
(the Hobby/free plan only allows daily cron invocations, too infrequent
for live scores). To refresh on demand without waiting for the schedule,
either call it directly or use the admin dashboard's "Refresh now" button:

```bash
curl -X POST http://localhost:3000/api/admin/refresh -H "x-admin-secret: $ADMIN_SECRET"
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in the Supabase values -
the rest have working defaults:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | _(required)_ | Supabase project URL (see `supabase/schema.sql`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | _(required)_ | Supabase anon/public key - RLS restricts it to read-only. |
| `SUPABASE_SERVICE_ROLE_KEY` | _(required)_ | Supabase service-role key - server-only, used by the seed/ingest/admin-mutate routes to bypass RLS for writes. Never expose to the client. |
| `ADMIN_SECRET` | _(required)_ | Shared passphrase gating the admin dashboard (`/api/admin/login` session) and the one-off `/api/admin/seed` / `/api/admin/refresh` routes (`x-admin-secret` header). |
| `CRON_SECRET` | _(required for the scheduled cron)_ | Required by Vercel Cron to call `/api/cron/ingest` (sent as `Authorization: Bearer $CRON_SECRET`, per Vercel's convention). |
| `NEXT_PUBLIC_USE_MOCK_DATA` | `false` | Controls which provider the **server-side ingest job** uses. Live ESPN scores/events are the default; set to `true` to use the scripted mock/seed data instead (local dev / demo). |
| `API_FOOTBALL_KEY` | _(none)_ | Optional legacy provider ([API-Football](https://www.api-football.com/)) for the ingest job - if set alongside `NEXT_PUBLIC_USE_MOCK_DATA=false`, used instead of the default ESPN provider. Its free tier doesn't cover the 2026 World Cup. |
| `NEXT_PUBLIC_LIVE_POLL_INTERVAL_MS` | `60000` | How often the browser polls `/api/league-snapshot`, in ms. Only affects UI freshness, not how often the cron re-ingests ESPN. |

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
        admin/                # admin dashboard (passphrase-gated)
      cast/                  # full-screen cast mode (no nav)
      layout.tsx             # live-polling provider
    api/cron/ingest/route.ts     # scheduled ESPN -> Supabase ingest (see docs/supabase-migration.md)
    api/admin/seed/route.ts      # idempotent Supabase seed load
    api/admin/refresh/route.ts   # on-demand ingest trigger
    api/league-snapshot/route.ts # read-only Supabase snapshot - every page's data source
    api/admin/login|logout|session/route.ts  # passphrase session cookie
    api/admin/mutate/route.ts    # dispatches every admin write to Supabase
  components/
    leaderboard/, events/, matches/, squad/, admin/, shared/, ui/
  lib/
    types.ts                 # core domain types
    scoring.ts                # scoring engine (pure functions)
    selectors.ts              # derived state (leaderboard, feeds, etc.)
    store/league-store.ts     # Zustand read cache, hydrated from Supabase
    store/mutations.ts        # pure admin-action logic used by the mutate route
    data/seed.ts              # the real league's managers, squads, matches, events
    data/espn-fixture-map.ts  # SEED_MATCHES id -> ESPN event id mapping
    data/api-football-mapping.ts  # legacy fixture/player ID map for API-Football mode
    api/                       # mock, ESPN and API-Football provider adapters (server-side only)
    hooks/use-supabase-snapshot-polling.ts  # polls the Supabase snapshot
    hooks/use-league-actions.ts  # admin write actions, POSTed to /api/admin/mutate
    supabase/                  # Supabase clients + row<->domain mappers (see docs/supabase-migration.md)
    server/                    # server-only helpers (admin auth, league-data read/write, live-data ingest)
supabase/schema.sql          # Supabase schema - apply via the SQL editor
```

## Scoring rules

Scoring values live in Supabase (`scoring_rules`, editable from the
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

`src/lib/server/ingest-live-data.ts` runs on a schedule
(`/api/cron/ingest`, called every 5 minutes by
`.github/workflows/ingest-cron.yml`) and on demand (the admin
dashboard's "Refresh now", or `POST /api/admin/refresh`):

1. Fetches the active provider's matches and merges status/score/minute
   into Supabase's `matches` table (locked matches are skipped).
2. For every completed, unlocked match, `computeMatchResultEvents`
   (`src/lib/scoring.ts`) derives clean-sheet and team win/loss/3+ bonus
   events from the final score - recomputed fresh on every run, so a
   provider correcting an earlier wrong score still lands the right
   bonus. Clean sheets are skipped for squad GK/Defenders who didn't
   appear, or appeared under 60 minutes, per
   `EspnProvider.getCleanSheetIneligibleAssetIds`.
3. Fetches individual player events (goals, assists, cards, own goals,
   missed penalties, shootouts) for any live or completed match.

Every event is deduped via `fantasy_events.event_hash`'s unique
constraint - a re-run (or a completed match re-checked to catch a missed
live window) never double-counts. Every browser then reads the same rows
back via `/api/league-snapshot`
(`src/lib/hooks/use-supabase-snapshot-polling.ts`), polling every
`NEXT_PUBLIC_LIVE_POLL_INTERVAL_MS` (default 60s).

- **Mock mode**: set `NEXT_PUBLIC_USE_MOCK_DATA=true` to have the
  ingest job use `src/lib/api/mock-provider.ts`'s scripted events
  instead of live ESPN data (local dev / demo).
- **ESPN mode (default)**: `src/lib/api/espn-provider.ts` pulls real
  scores/events from ESPN's free public scoreboard for the fixtures
  listed in `src/lib/data/espn-fixture-map.ts` (Group Stage · Matchdays
  1-3, `m1`-`m66`) - no API key or per-player ID mapping needed. Penalty
  saves in regular play are matched to the opposing keeper
  automatically too.
- **Dynamic knockout fixtures**: Round of 32 onward can't be pre-mapped
  in `espn-fixture-map.ts` because the matchups depend on final group
  standings. Instead, `discoverDynamicMatches` (in `espn-provider.ts`)
  scans ESPN's scoreboard (now covering the whole tournament,
  `ESPN_SCOREBOARD_DATE_RANGE`) for any fixture not already in
  `ESPN_FIXTURE_ID_MAP` that involves a country picked by a squad, and
  the ingest job upserts it as a new match automatically - it then gets
  the same live score/event syncing as every other fixture, no manual
  setup needed each round.
- **Manual result correction**: the admin Matches tab has an "Edit
  result" button on every fixture, for use when a match isn't covered by
  the live provider yet or its data is wrong. Setting status/scores
  there and marking a match "Completed" awards clean sheet and team
  result bonuses immediately, via the same `computeMatchResultEvents`
  logic the ingest job uses.
- **API-Football mode (legacy)**: set `NEXT_PUBLIC_USE_MOCK_DATA=false`
  and `API_FOOTBALL_KEY`. `src/lib/api/api-football-provider.ts` calls
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
bonuses, and the player/team isolation rules). `src/lib/store/__tests__/mutations.test.ts`
covers every admin action's pure logic (event/adjustment CRUD, scoring
recalculation, match locking/correction including the
already-completed-match score-correction regression, and squad-mapping
edits). `src/lib/api/__tests__/espn-provider.test.ts` covers ESPN event
mapping, name/country normalization, and clean-sheet eligibility.

## Deploying to Vercel

1. Push this repo to GitHub and import it into [Vercel](https://vercel.com/new).
2. Add the [Supabase integration](https://vercel.com/integrations/supabase)
   (or set the Supabase env vars by hand) plus `ADMIN_SECRET` and
   `CRON_SECRET`.
3. Apply `supabase/schema.sql` via the Supabase SQL editor.
4. Deploy, then seed once: `POST /api/admin/seed` with the
   `x-admin-secret` header.
5. Add a `CRON_SECRET` repository secret in GitHub (Settings -> Secrets
   and variables -> Actions) matching the same env var in Vercel -
   `.github/workflows/ingest-cron.yml` calls `/api/cron/ingest` every 5
   minutes to keep data fresh (not Vercel Cron - the Hobby plan only
   allows daily invocations, too infrequent for live scores).

Share `https://<your-app>.vercel.app/league/world-cup-draft` with your
league - the "Copy invite link", WhatsApp and QR code buttons on the
leaderboard page all point at that URL.

## Known limitations

- **Realtime is polling-based**, not push - every browser polls
  `/api/league-snapshot` on an interval rather than subscribing to
  Supabase Realtime. Good enough for a league this size; see
  docs/supabase-migration.md for the upgrade path.
- **Admin auth is a single shared passphrase**, not per-manager
  accounts - anyone with the passphrase can edit scoring, events and the
  squad mapping. Supabase Auth + a role check would be the natural next
  step if you need to restrict access more granularly.
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

- Supabase Realtime subscriptions instead of snapshot polling, for
  instant updates without the interval delay.
- Supabase Auth for per-manager admin accounts and per-action audit
  identities, instead of one shared passphrase.
- Add push notifications / toasts for live scoring events.
- Add a draft/squad-editing flow for future seasons.
