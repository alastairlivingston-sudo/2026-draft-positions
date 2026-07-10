# Incident: scores stopped auto-updating (France v Morocco QF)

**Date:** 2026-07-10
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
