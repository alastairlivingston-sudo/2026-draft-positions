# Incident: scores stopped auto-updating (France v Morocco QF)

**Date:** 2026-07-10 to 2026-07-11
**Status:** Resolved.
**Symptom:** France 2-0 Morocco (Quarter-final) wasn't showing on the site,
even after a browser refresh.

## Root cause

Two compounding issues:

1. **GitHub's registered default branch was stale.** `main` was created
   from `claude/supabase-backend-0f66cv` on 2026-07-08 (see
   `docs/enterprise-git-workflow.md`) to become the project's trunk, but the
   repository's actual default-branch setting on GitHub was never switched
   over - it still pointed at `claude/supabase-backend-0f66cv`, six commits
   behind. GitHub Actions only registers scheduled (`on.schedule`) workflows
   from files present on the real default branch, so `.github/workflows/ingest-cron.yml`
   (added in commit `8e2a31e`, main-only) was never registered - the
   5-minute ESPN ingest cron had never once run.
2. **A browser refresh can't work around this.** The client only polls
   `/api/league-snapshot`, which reads whatever the ingest job last wrote to
   Supabase. With the cron never running, there was nothing new to read no
   matter how many times the page reloaded.

Fixed by switching the GitHub repo's default branch to `main` (Settings ->
Branches), which immediately registered the workflow (confirmed via the
Actions API - `total_count` went from 0 to 1, workflow `state: active`).
A one-off `POST /api/admin/refresh` was also run to backfill the missed
France v Morocco result immediately rather than waiting for the next tick.

### Follow-up: the now-registered cron still fails (401)

Once registered, the workflow started running every 5 minutes as intended -
but every run fails in ~7s with exit code 22 (curl `--fail` on an HTTP error
response). `GET /api/cron/ingest` returns 401 Unauthorized:

```ts
// src/lib/server/route-auth.ts
export function isCronRequestAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
```

The workflow file's own header comment says it "requires one repository
secret: `CRON_SECRET`, matching the same-named env var on the Vercel
project" - but since this cron had never actually run before (see above),
that setup step was apparently never done. Either the `CRON_SECRET` GitHub
Actions repo secret was never created, or it doesn't match the `CRON_SECRET`
env var on Vercel.

**End-user consequence:** functionally identical to the original symptom.
The schedule fires on time, but every invocation dies at the auth check
before it ever calls ESPN or writes to Supabase - so match scores, minutes,
and status, along with derived goals/assists/cards/clean-sheet/win-bonus
fantasy events, stay frozen at whatever they were last set to (currently
accurate only because of the manual `/api/admin/refresh` backfill above).
It's indistinguishable from "not updating" to a user; only the underlying
cause has changed. The admin dashboard's "Refresh" button remains the only
working manual path until this is fixed.

**Fix (needs dashboard access, not done here):**
1. Generate a random secret value.
2. GitHub repo -> Settings -> Secrets and variables -> Actions -> New
   repository secret -> name `CRON_SECRET`, paste the value.
3. Vercel project -> Settings -> Environment Variables -> add `CRON_SECRET`
   with the *same* value for Production, then redeploy.
4. Re-run the workflow (or wait for the next tick) and confirm it succeeds.

### Second false start: saved to the wrong GitHub location

The first attempt to add `CRON_SECRET` on the GitHub side didn't fix
anything - the value had been added under **Settings -> Environments ->
(an environment) -> Environment variables**, not the repository-level
secret the workflow actually reads. Two problems with that:

- Secrets/variables scoped to a GitHub *Environment* are only visible to a
  job that declares `environment: <name>` - `ingest-cron.yml`'s `ingest` job
  has no such key, so the value was invisible to it regardless of naming.
- It was entered as an environment *variable* (`vars.*` context, stored and
  displayed in plaintext), not a *secret* (`secrets.*` context). The
  workflow reads `secrets.CRON_SECRET`, which never resolves a variable.

Confirmed via the job log for the run that followed: it sent
`Authorization: Bearer ` with nothing after `Bearer ` - i.e.
`secrets.CRON_SECRET` was still resolving to an empty string in the
workflow's context.

**Actual fix:** repo root -> Settings -> Secrets and variables -> Actions ->
**"Secrets" tab** (not "Variables", not under Environments) -> New
repository secret -> `CRON_SECRET`. Combined with the same value already
set on Vercel, this resolved it.

### Resolution confirmed

Rather than wait for the next (heavily throttled, see Prevention below)
scheduled tick, the workflow was triggered on demand via
`workflow_dispatch`. That run completed with `conclusion: success` at
2026-07-11T06:42Z - the first successful run since the cron was registered.
`/api/league-snapshot`'s `fetchedAt` advanced to match
(`2026-07-11T06:43:03Z`), confirming it wrote fresh data rather than just
returning 200. `CRON_SECRET` is now correctly set on both GitHub Actions
(repository secret) and Vercel (Production env var), and the two values
match.

## Prevention

- When promoting a new trunk branch (per `docs/enterprise-git-workflow.md`),
  switching GitHub's default-branch setting is part of that migration, not
  an optional follow-up - anything that depends on "the default branch"
  (Actions schedules, branch protection, PR base) silently no-ops otherwise.
- A workflow that has never run has an unverified setup: its `README`/header
  comments describing required secrets are easy to skip since nothing forces
  you to revisit them. Once the default-branch fix let this cron register,
  it immediately surfaced the still-missing `CRON_SECRET` setup step - worth
  checking for other "add this secret" instructions left undone elsewhere in
  the repo's workflow files.
- The admin dashboard's "Refresh" button (`/api/admin/refresh`) is the
  correct manual workaround if live scores ever look stale again - it
  triggers the same ingest path as the cron, on demand, with no auth gate.
- GitHub Actions does not honor `*/5 * * * *` precisely - observed actual
  spacing between runs was roughly 1-2 hours, not 5 minutes, which GitHub
  attributes to scheduling load rather than anything in this repo's config.
  Don't rely on the schedule for near-real-time freshness; the admin
  "Refresh" button is the dependable path right after a match ends.
- GitHub's Environments feature (Settings -> Environments) and its
  per-environment secrets/variables are a separate, easily-confused system
  from repository-level Actions secrets (Settings -> Secrets and variables
  -> Actions). A workflow only sees environment-scoped values if its job
  explicitly opts in with `environment: <name>` - otherwise entries made
  there are silently inert. When a workflow references `secrets.<NAME>`,
  add it as a *repository* secret unless the job specifically uses an
  environment.
