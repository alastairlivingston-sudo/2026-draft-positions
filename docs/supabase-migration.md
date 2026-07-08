# Migrating to a Supabase backend

**Status: complete.** Supabase is the league's single source of truth.
This doc records why and how the migration happened, phase by phase, for
future reference.

## Why

The league's source of truth used to be a Zustand store persisted to
`localStorage`. Every browser/device had its own copy: an admin
correction made on one phone didn't show up on another manager's laptop
until that browser independently re-derived the same state from ESPN,
and manual edits (adjustments, mapping corrections, locked matches) never
propagated at all. That was the root cause of stale/inconsistent state
across devices. The sibling app `nfl-blackjack` already solved this the
standard way - a shared server-side Postgres database via Supabase - and
this migration brought this app onto the same model.

## v1 decisions

- **Auth**: none - the admin dashboard is open to anyone with the link,
  same as before the migration. A shared-passphrase gate (`ADMIN_SECRET`)
  was built and shipped in Phase 3, then removed shortly after: the env
  var couldn't be re-verified once saved (most dashboards mask secret
  values after creation) and iPad Safari's password autofill made typing
  it back in unreliable, so it consistently rejected correct passphrases
  in practice. Given this app has flip-flopped on admin auth before (it
  shipped with none, briefly, before this migration too) and the league
  is small and trusted, removing it again was the pragmatic call rather
  than debugging the input flow further. Supabase Auth remains the
  natural upgrade if per-manager accounts are ever needed.
- **Freshness**: snapshot polling (`/api/league-snapshot`, every
  `NEXT_PUBLIC_LIVE_POLL_INTERVAL_MS`). Supabase Realtime subscriptions
  can replace polling later without changing the schema.
- **Reuse**: `src/lib/scoring.ts` and `src/lib/selectors.ts` are pure
  functions over plain data and were reused as-is - only the *storage*
  layer changed, not the scoring/derivation logic. The ESPN/API-Football
  provider adapters in `src/lib/api/` were also reused unchanged, just
  called from the server-side ingest job instead of the browser.

## Schema

`supabase/schema.sql` - apply it via the Supabase SQL editor (no migration
runner is wired up). Tables: `managers`, `squad_assets`, `matches`,
`scoring_rules`, `fantasy_events`, `manual_adjustments`, `audit_log`,
`api_event_cache` (unused now - superseded by `fantasy_events.event_hash`
dedup; kept in the schema rather than dropped, since removing a table
needs a real migration path this project doesn't have). RLS: public read
on every table; all writes go through the service-role key from trusted
server code.

## How it was built

Each phase shipped independently, guarded behind a
`NEXT_PUBLIC_USE_SUPABASE` flag until Phase 4 removed the flag and the
code path it guarded (the old localStorage/ESPN-client-polling app)
entirely.

- **Phase 0 - foundation** (`src/lib/supabase/`): Supabase clients
  (browser/server anon clients for reads, an admin service-role client
  for writes), row<->domain-type mappers, and an idempotent seed route
  (`POST /api/admin/seed`) that loads `SEED_*` from `src/lib/data/seed.ts`
  into Supabase - that seed data *is* the real league, not a demo fixture.
- **Phase 1 - server-side ingestion** (`src/lib/server/ingest-live-data.ts`):
  a scheduled cron (`GET /api/cron/ingest`, called every 5 minutes by
  `.github/workflows/ingest-cron.yml` - not Vercel Cron, whose Hobby plan
  only allows daily invocations) fetches ESPN, runs the existing
  result/event derivation
  (`computeMatchResultEvents`, `calculateEventPoints`), and upserts
  `matches` + `fantasy_events` into Supabase, deduped via the
  `fantasy_events.event_hash` unique constraint - replacing the old
  per-browser `apiEventCache`. `POST /api/admin/refresh` is the same
  pipeline triggered on demand.
- **Phase 2 - shared reads** (`/api/league-snapshot`,
  `useSupabaseSnapshotPolling`, `hydrateFromSnapshot`): rather than
  rewriting every page's data access, `LivePollingProvider` polls a
  read-only Supabase snapshot route and replaces the store's data
  wholesale (Supabase is the single source of truth, so no client-side
  merge/derive needed). Every page still reads from `useLeagueStore`
  unchanged - only *how* it gets populated differs.
- **Phase 3 - admin writes** (`src/lib/store/mutations.ts`,
  `POST /api/admin/mutate`, `useLeagueActions`): each admin mutation
  (add/update/delete event, add/delete adjustment, scoring rules,
  recalculate, lock, match-result correction, squad mapping) is a pure
  `apply*` function operating on a `LeagueData` snapshot. A single
  RPC-style route dispatches to them against a fresh Supabase read, then
  `writeBackLeagueData` upserts/deletes only the tables that changed.
  `useLeagueActions` gives every admin tab (and the public Match Centre's
  lock toggle) the write actions, POSTing to the mutate route and
  triggering an immediate snapshot re-poll. This phase originally added a
  shared-passphrase login (`AdminGate`, `/api/admin/login`) gating the
  dashboard and these routes; see "v1 decisions" above for why that was
  removed again shortly after.
- **Phase 4 - cutover**: removed the flag and the code it guarded -
  `league-store.ts`'s Zustand `persist` middleware/localStorage, the
  versioned migration logic, `apiEventCache`/`resultComputedMatchIds`,
  and the client-side `ingestApiEvents`/`syncMatches`/`useLivePolling`
  path (and its `/api/live` route) that derived events from ESPN in the
  browser. `league-store.ts` is now just a plain in-memory read cache
  populated by `hydrateFromSnapshot`; every write and every ESPN fetch
  happens server-side. Test coverage for the removed store logic moved
  to `src/lib/store/__tests__/mutations.test.ts`, testing the pure
  `apply*` functions directly instead of the old store actions.
- **Post-cutover fixes**: two schema columns had drifted behind
  `src/lib/types.ts` (`squad_assets.unavailable`, and three missing
  `audit_log.action` check-constraint values) and broke seeding on a
  fresh database - fixed in schema.sql, but an already-applied database
  needs the equivalent `ALTER TABLE` run by hand (no migration runner).
  Separately, the server-side ingest only deduped by `event_hash`,
  which curated seed events don't have (`eventHash: null`) - a live
  re-fetch of an event the seed already recorded landed as a second row
  under a different hash, double-counting real matches' points. Fixed
  by also deduping on `eventIdentityKey` (matchId, assetId, type,
  minute) in both `ingest-live-data.ts` and
  `applyUpdateMatchResult` - see `excludeEventsMatchingExisting` in
  `scoring.ts`. `POST /api/admin/reset` (+ an "Clear all" dashboard
  button) was added to recover from data affected by this before the fix.

## What's not covered

- **`ingest-live-data.ts` has no automated tests** - it talks directly to
  Supabase, and the regression scenarios the old `syncMatches` store
  tests covered (locked-match protection during automatic sync, in
  particular) aren't re-tested against the live database calls. The
  equivalent logic for admin-triggered match corrections *is* tested,
  in `mutations.test.ts`.
- **No Supabase Realtime** - see "Freshness" above.
