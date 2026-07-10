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

## Prevention

- When promoting a new trunk branch (per `docs/enterprise-git-workflow.md`),
  switching GitHub's default-branch setting is part of that migration, not
  an optional follow-up - anything that depends on "the default branch"
  (Actions schedules, branch protection, PR base) silently no-ops otherwise.
- The admin dashboard's "Refresh" button (`/api/admin/refresh`) is the
  correct manual workaround if live scores ever look stale again - it
  triggers the same ingest path as the cron, on demand, with no auth gate.
