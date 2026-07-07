# Supabase migration plan

## Why

The league state lives in each viewer's **browser** (`localStorage`, via the
Zustand `persist` store in `src/lib/store/league-store.ts`). Every browser holds
its own private copy of managers, squads, matches, events, scoring and audit log,
and ingests the live feed + computes points independently. That single decision
is the root cause of a class of bugs:

- Stale results (e.g. Norway's Round-of-16 win over Brazil not showing) when an
  older/mock-era browser state doesn't re-derive.
- Different people seeing **different totals** on different devices.
- Admin edits (scoring, adjustments, locks, squad mapping) that don't reach anyone
  else's screen.
- No way to "fix it once for everyone" — every fix relies on each viewer's local
  state healing.

By contrast, the sibling app `nfl-blackjack` keeps a **server-side Postgres DB** as
the single source of truth: a cron computes the leaderboard once, and every viewer
reads the same precomputed data. The stale-per-browser bug is structurally
impossible there. This plan brings the same model here.

## Constraint: free + out-of-box

- **Free tier is ample** for an 8-manager league (hundreds of rows): 500 MB DB,
  unlimited API requests, Realtime, free Auth.
- **Out-of-box:** the Vercel → Supabase integration provisions the project and
  injects `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
  `SUPABASE_SERVICE_ROLE_KEY` into the Vercel project automatically.
- **Caveat:** free-tier projects pause after 7 days of inactivity. The daily
  ingest cron keeps it warm during the tournament; resume is one click otherwise.

## Target architecture (mirrors nfl-blackjack)

```
ESPN → server cron (/api/cron/ingest) → compute events (src/lib/scoring.ts)
       → write once to Supabase Postgres   ← single source of truth
Supabase → server-rendered reads → every viewer sees identical state
Admin UI → server actions (auth-gated) → write to Supabase → visible to all
```

The browser stops being the source of truth. Compute once on the server; everyone
reads the same data.

## What already exists vs. what's needed

- **Done:** `supabase/schema.sql` — all tables (managers, squad_assets, matches,
  scoring_rules, fantasy_events with a `event_hash unique` dedup column,
  manual_adjustments, audit_log, api_event_cache), RLS enabled with public-read
  policies.
- **Add:** `matches.winner` column (shootout result), and — under the
  shared-passphrase model — writes go through the server-only service-role key
  which bypasses RLS, so no extra write policies are needed (public stays
  read-only via the anon key + existing policies).
- **Reused as-is:** `src/lib/scoring.ts`, `src/lib/selectors.ts` (pure), the ESPN
  providers in `src/lib/api/`.
- **Replaced:** `src/lib/store/league-store.ts` (localStorage) and the client-side
  ingestion in `src/lib/hooks/use-live-polling.ts`.

## Phases (each independently deployable, guarded by `NEXT_PUBLIC_USE_SUPABASE`)

### Phase 0 — Provision & scaffold (no behavior change)
- ~~Add the Vercel → Supabase integration~~ **DONE** — Supabase is provisioned;
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
  `SUPABASE_SERVICE_ROLE_KEY` are in the Vercel project.
- Add `@supabase/supabase-js` + `@supabase/ssr`; create server + browser clients.
- Apply `supabase/schema.sql` (already includes the `winner` column). The session
  may not have the DB credentials locally (they live in Vercel) — either
  `vercel env pull` them into `.env.local`, or paste `supabase/schema.sql` into the
  Supabase dashboard **SQL editor**.
- Idempotent **seed** loading `SEED_*` (managers, squad_assets, matches,
  scoring_rules, seed events/adjustments) into the DB — seed == the real league.
  Prefer an admin-triggered seed **route** (uses the server service-role key) so no
  local DB credentials are needed; a `scripts/` seed is fine if creds are pulled.

### Phase 1 — Server-side ingestion (the actual fix)
- New cron route `/api/cron/ingest` (scheduled in `vercel.json`): fetch ESPN → run
  the existing result/event derivation server-side → upsert matches + insert events
  into Supabase. Dedup is enforced by the DB (`event_hash unique`), replacing the
  per-browser `apiEventCache`.
- Admin "refresh now" triggers the same job.
- This is where "compute once, shared by everyone" happens.

### Phase 2 — Shared reads
- Convert read pages (leaderboard, manager, matches, events, rules, cast) to server
  components loading from Supabase and feeding the existing `selectors.ts`. UI
  components unchanged.
- Live updates: start by polling a server snapshot endpoint (simplest); optionally
  upgrade to Supabase Realtime for pushed updates.

### Phase 3 — Admin writes + auth
- Convert the store's admin actions to server actions writing to Supabase.
- Admin auth: shared passphrase (env secret) gating the server actions for v1.
- Tighten RLS if moving to Supabase Auth later.

### Phase 4 — Cutover & cleanup
- Flip `NEXT_PUBLIC_USE_SUPABASE` on; retire localStorage persistence.
- No user-data migration needed (DB seeds from code; cron backfills results).
- Update README.

## Decisions (confirmed for v1)
- **Admin auth:** shared passphrase (env secret) gating admin server actions.
- **Live updates:** poll a server snapshot endpoint. (Supabase Realtime later.)

## Effort / risk / rollback
- ~2–4 days across phases; each ships independently.
- Low, staged risk: the flag keeps today's app working until Phase 4; schema is
  additive; pure scoring logic (and its 80 tests) is unchanged.
- Rollback: flip the flag / Vercel Instant Rollback. Nothing destructive.

## Status
Supabase is **provisioned** (env vars in Vercel). Ready to build Phases 0–1 on
this branch (`claude/supabase-backend`). Keep the live app untouched behind the
`NEXT_PUBLIC_USE_SUPABASE` flag until cutover.
