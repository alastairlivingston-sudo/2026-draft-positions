# Migrating to a Supabase backend

## Why

The league's source of truth today is a Zustand store persisted to
`localStorage` (`src/lib/store/league-store.ts`). Every browser/device has
its own copy: an admin correction made on one phone doesn't show up on
another manager's laptop until that browser independently re-derives the
same state from `/api/live`, and manual edits (adjustments, mapping
corrections, locked matches) never propagate at all. This is the
root cause of stale/inconsistent state across devices. The sibling app
`nfl-blackjack` already solved this the standard way - a shared server-side
Postgres database via Supabase - and this migration brings this app onto
the same model.

## v1 decisions

- **Auth**: a single shared admin passphrase kept in an env var
  (`ADMIN_SECRET`) - sent as a header for one-off routes, or as an
  httpOnly session cookie for the admin dashboard - not full Supabase
  Auth with per-manager accounts. Good enough for a league this size.
- **Freshness**: snapshot polling (matches the current `/api/live` polling
  model). Supabase Realtime subscriptions can replace polling later
  without changing the schema.
- **Reuse**: `src/lib/scoring.ts` and `src/lib/selectors.ts` are pure
  functions over plain data and are reused as-is - only the *storage*
  layer changes, not the scoring/derivation logic. The ESPN/API-Football
  provider adapters in `src/lib/api/` are also reused unchanged.
- Everything is guarded behind `NEXT_PUBLIC_USE_SUPABASE` (default
  `false`) until cutover, so each phase ships without breaking the live app.

## Schema

`supabase/schema.sql` - apply it via the Supabase SQL editor (no migration
runner is wired up yet). Tables: `managers`, `squad_assets`, `matches`,
`scoring_rules`, `fantasy_events`, `manual_adjustments`, `audit_log`,
`api_event_cache` (retained for now; superseded by `fantasy_events.event_hash`
dedup once ingestion moves server-side). RLS: public read on every table;
all writes go through the service-role key from trusted server code.

## Phases

- **Phase 0 - foundation** (`src/lib/supabase/`): `@supabase/supabase-js` +
  `@supabase/ssr` clients (browser/server anon clients for reads, an admin
  service-role client for writes), row<->domain-type mappers, and an
  idempotent seed route (`POST /api/admin/seed`) that loads `SEED_*` from
  `src/lib/data/seed.ts` into Supabase - that seed data *is* the real league,
  not a demo fixture.
- **Phase 1 - server-side ingestion** (`src/lib/server/ingest-live-data.ts`):
  a scheduled cron (`GET /api/cron/ingest`, see `vercel.json`) fetches ESPN,
  runs the existing result/event derivation (`computeMatchResultEvents`,
  `calculateEventPoints`), and upserts `matches` + `fantasy_events` into
  Supabase, deduped via the `fantasy_events.event_hash` unique constraint -
  replacing the per-browser `apiEventCache`. `POST /api/admin/refresh` is
  the same pipeline triggered on demand. Both no-op while
  `NEXT_PUBLIC_USE_SUPABASE` is off.
- **Phase 2 - shared reads** (`/api/league-snapshot`,
  `useSupabaseSnapshotPolling`, `hydrateFromSnapshot`): rather than
  rewriting every page's data access, `LivePollingProvider` now polls a
  read-only Supabase snapshot route and replaces the store's data
  wholesale (Supabase is already the single source of truth, so no
  client-side merge/derive needed) when the flag is on, in place of the
  ESPN-derived `useLivePolling`/`syncMatches`/`ingestApiEvents` path.
  Every page still reads from `useLeagueStore` unchanged - only *how* it
  gets populated differs.
- **Phase 3 - admin writes + auth** (`src/lib/store/mutations.ts`,
  `POST /api/admin/mutate`, `useLeagueActions`, `AdminGate`): each of the
  10 store mutations (add/update/delete event, add/delete adjustment,
  scoring rules, recalculate, lock, match-result correction, squad mapping)
  has a parallel pure `apply*` function operating on a `LeagueData`
  snapshot instead of Zustand `get()`/`set()` - kept separate from
  `league-store.ts` rather than refactored in place, so the well-tested
  localStorage path is completely untouched. A single RPC-style route
  dispatches to them against a fresh Supabase read, then
  `writeBackLeagueData` upserts/deletes only the tables that changed.
  `useLeagueActions` gives every admin tab the exact same action
  signatures as the store, swapping to Supabase calls (+ an immediate
  snapshot re-poll) only when the flag is on - no tab needed a Supabase-
  specific code path. Auth: a shared passphrase (`ADMIN_SECRET`), entered
  once via `/api/admin/login` into an httpOnly session cookie
  (`AdminGate`/`AdminLogoutButton`) rather than resending it on every
  click; `/api/admin/seed` and `/api/admin/refresh` keep the simpler
  one-off `x-admin-secret` header since they're called rarely.
- **Phase 4 - cutover**: flip `NEXT_PUBLIC_USE_SUPABASE` to `true` by
  default, remove the Zustand `persist` middleware/localStorage code path,
  and retire `api_event_cache`/the client-side dedup logic now that the DB
  is the single source of truth.

## Status

- [x] Phase 0
- [x] Phase 1
- [x] Phase 2
- [x] Phase 3
- [ ] Phase 4
