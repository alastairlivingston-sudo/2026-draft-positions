# Enterprise Git Workflow for Claude Code

Instructions for Claude Code (Enterprise) to pull the latest code from git and
make changes safely in this repository.

> This project is **not** the Next.js you may know. APIs, conventions, and file
> structure may differ from training data. Before writing code, read the
> relevant guide under `node_modules/next/dist/docs/` and heed any deprecation
> notices. See `AGENTS.md`.

---

## 1. Sync the latest code

Never start work on a stale checkout. Always fetch and fast-forward the default
branch first.

```bash
# Identify the default branch (usually main)
git remote show origin | sed -n 's/.*HEAD branch: //p'

# Fetch and update
git fetch origin
git checkout main
git pull --ff-only origin main
```

If `git pull --ff-only` fails, your local branch has diverged — do not force.
Inspect with `git status` and `git log --oneline origin/main..HEAD`, then rebase
or reset as appropriate.

**On network errors** (fetch/pull/push), retry up to 4 times with exponential
backoff: 2s, 4s, 8s, 16s. Do not disable TLS verification or work around the
proxy.

---

## 2. Create a working branch

Never commit directly to `main`. Branch off the freshly-updated default branch.

```bash
git checkout -b claude/<short-descriptive-name> main
```

Use a `claude/` prefix and a kebab-case description of the change, e.g.
`claude/fix-penalty-scoring`.

---

## 3. Make changes

1. Read before you write. Understand the surrounding code and match its
   conventions (naming, comment density, idioms).
2. Consult `node_modules/next/dist/docs/` for any Next.js API you touch.
3. Keep changes scoped to the task. Avoid unrelated refactors.

---

## 4. Verify locally

Run the project's checks before committing. All must pass.

```bash
npm install        # only if dependencies changed
npm run lint       # eslint
npm run test       # vitest
npm run build      # next build — catches type/build errors
```

Fix failures before proceeding. If a check is genuinely unrelated and
pre-existing, note it rather than silently skipping.

---

## 5. Commit

Stage intentionally (avoid `git add -A` unless you've reviewed everything) and
write a clear, imperative-mood message describing *why*.

```bash
git add <files>
git commit -m "Short imperative summary

Optional body explaining the rationale and any trade-offs."
```

Do not commit secrets, `.env` files, or build artifacts. Respect `.gitignore`.

---

## 6. Push

```bash
git push -u origin claude/<short-descriptive-name>
```

Retry on network errors with the same 2s/4s/8s/16s backoff. Only push to your
own working branch — never to `main` or another branch without explicit
permission.

---

## 7. Pull request (only when asked)

Do **not** open a PR unless explicitly requested. When you do:

- Check for a template (`.github/pull_request_template.md`,
  `.github/PULL_REQUEST_TEMPLATE.md`, root, or `docs/`). If present, mirror its
  section headings and fill them from your changes.
- Summarize what changed and why, and note how it was verified.
- Skip any template section asking for credentials, tokens, or internal
  hostnames — describe only the code changes.

---

## Guardrails

- **One branch, one purpose.** Keep unrelated work on separate branches.
- **Never force-push** shared branches.
- **A merged PR is finished.** For follow-up work, restart your branch from the
  latest default branch rather than stacking onto merged history.
- **Confirm irreversible or outward-facing actions** (deletes, external sends)
  before proceeding unless already authorized.
- **Report faithfully.** If tests fail or a step was skipped, say so with the
  output.
