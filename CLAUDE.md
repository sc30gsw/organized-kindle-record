# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`kindle-to-notion` — a one-maintainer TypeScript importer that ingests Glasp-exported Kindle highlight markdown files from `Glasp Kindle Highlights/` and writes them as pages into a Notion database.

`app/` is a TanStack Start web UI over the same Notion database (see **Web app (`app/`)** below). The two share the root `src/` code through the `~/` alias.

> The directory name in code is `Glasp Kindle Highlights` (`src/import-all.ts` / `src/update-highlights.ts` resolve it from `process.cwd()`). `.gitignore` covers both that and the lowercase `glasp-kindle-highlights/` so the export is ignored on case-sensitive filesystems too.

## Runtime & tools

- Run TS directly with `tsx` (no build step). All entry points live in `src/`.
- `package.json` `"type": "module"` — sources are ESM.
- `tsconfig.json` uses `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, `strict: true`. Honor strict mode in new code.
- `mise.toml` pins `aube` (package manager; lockfile: `aube-lock.yaml`). It is not in the mise registry; do not try to `mise install` it. Use `aube install` / `aube add` instead of npm.

## Required env

**`dotenv.config` is called in exactly one place: `src/lib/env.ts`.** It walks up from `process.cwd()` to find `.env`, so it resolves the same file whether you start from the repo root (CLI) or from `app/` (vite). Never add another `dotenv.config` call and never read `process.env` outside an env module.

Two env modules, both validating at import time (a missing **or empty** value throws with the key name):

- `src/lib/env.ts` — CLI: `NOTION_TOKEN`, `NOTION_TARGET_PAGE_ID`
- `app/src/lib/env.ts` — web app: the 8 keys below **plus** the 2 above (valibot, `v.minLength(1)`)

| Key | Used for |
| --- | --- |
| `NOTION_TOKEN` | Notion integration token (insert + update on the target page) |
| `NOTION_TARGET_PAGE_ID` | Parent page where `create-db` provisions the database |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Turso: better-auth tables + `mind_map` |
| `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` | Notion **OAuth** for app login (distinct from `NOTION_TOKEN`) |
| `ALLOWED_NOTION_EMAIL` | The single account allowed to log in |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` / `BETTER_AUTH_API_KEY` | better-auth + the `dash` plugin |

`.env.example` lists all 10 with one-line comments. `create-db` writes the database ID to `db-id.txt` (gitignored) for subsequent runs.

`.env`, `db-id.txt`, `done.log`, `failed.json`, `parsed.json`, `node_modules/`, and `dist/` are all gitignored.

## Commands

```
aube run parse        # dry-run: parse all .md → parsed.json, surface bad inputs (no Notion writes)
aube run create-db    # one-time: create the Notion database under NOTION_TARGET_PAGE_ID, write db-id.txt
aube run pilot        # import the first 4 books only — required smoke test before a full import
aube run import       # full batch import (concurrency=3), appends to done.log and failed.json
aube run update       # incrementally append new highlights to existing pages
aube run update:dry   # same as update but no writes
aube run lint         # oxlint
aube run lint:fix     # oxlint --fix
aube run fmt          # oxfmt
aube run fmt:check    # oxfmt --check
aube run fix          # oxfmt + oxlint --fix
aube run check        # lint + fmt:check
```

Dependencies are managed with **aube** (`aube-lock.yaml`). Use `aube install` instead of `npm install`.

> **Dual-lockfile caveat**: locally this repo uses aube (`aube-lock.yaml`), but `app/` is built on Vercel with **pnpm** (`pnpm-lock.yaml`, frozen-lockfile). Whenever you change dependencies via `aube add` / `aube remove`, you MUST also run `pnpm install --lockfile-only` to sync `pnpm-lock.yaml`, and commit both lockfiles. Committing only one makes the Vercel build fail with `ERR_PNPM_OUTDATED_LOCKFILE`. Dependency-affecting overrides (e.g. `pnpm-workspace.yaml`'s `overrides`) must likewise be re-synced into both lockfiles.

**Safe import order is `parse` → `pilot` → `import`.** Skipping `pilot` risks creating hundreds of malformed pages under live Notion rate limits. Use the `/safe-import` skill to enforce this sequence. After failures, use `/notion-recover`.

## Notion API gotchas

These are baked into `src/notion-client.ts` and `src/import-book.ts`. Don't undo them without understanding why:

- **Retry**: `withRetry()` does exponential backoff (2s, 4s, 8s) on 429 / network errors, max 3 attempts. After that, the file path goes to `failed.json`.
- **Concurrency**: `p-limit(3)`. Notion's per-integration rate limit punishes higher concurrency; raise only with deliberate testing.
- **100-block limit**: A `pages.create` call accepts ≤100 children blocks. Highlights beyond 100 are appended in follow-up `blocks.children.append` batches of 100.
- **2000-char rich text limit**: `chunkText()` splits long highlights across multiple rich-text objects within a single block.
- **ASIN deduplication**: The importer queries the database by ASIN before creating a page. Removing this check will duplicate every book on the next run.
- **Process-lifetime memoisation**: `findOrCreateDatabase()` and `getPrimaryDataSourceId()` cache their resolved ids (the promise, so concurrent callers share one round trip). Without this the web app re-ran `blocks.children.list` + `databases.retrieve` on every request. Rejections are *not* cached. If you recreate the Notion database, restart the server — a long-lived process keeps the stale id.

## Markdown parser is strict

`src/parse-md.ts` assumes the exact Glasp export shape: `# {title}`, `- Author: {authors}`, `### Highlights & Notes`, `> {quote}` blocks each optionally followed by `- {note}` bullets, with an ASIN-bearing Kindle link. New input formats need parser changes, not workarounds in the importer.

## Code style

- File names are `kebab-case.ts` (existing examples: `import-all.ts`, `notion-client.ts`).
- Treat data as immutable — return new objects instead of mutating. `Book` / `Highlight` の canonical 定義は `ReturnType<typeof parseMd>` として `src/types/index.ts` から export される。関数引数は `Parameters<T>` や `Book['field']` で SSoT を参照し、ローカルに再宣言しない。
- Prefer `Result`-style returns over `try`/`catch` in new code (per user's global rules). `withRetry()` in `notion-client.ts` is the existing exception — leave it alone.
- Comments and user-facing log strings are Japanese throughout; keep new strings consistent with the surrounding file.
- Root `src/` is formatted with single quotes (`.oxfmtrc.json`); `app/` uses vite-plus defaults (double quotes). Match the package you are in.

## Tests

There is no separate runner for the root package. Tests run through the app's vitest:

```
cd app && vp test
```

`app/vite.config.ts` sets `test.include` to `["src/**/*.test.{ts,tsx}", "../src/**/*.test.ts"]`, so a
test placed next to root CLI code (e.g. `src/parse-md.test.ts`) is picked up too. Import test
utilities from `vite-plus/test`, never from `vitest` directly. Root `tsconfig.json` excludes
`src/**/*.test.ts` (the root package has no vite-plus); `app/tsconfig.json` type-checks them instead.

Covered today: `computeCollapseState`, the mind-map graph schema boundary, `selectedTextWithin`, and
`parseMdContent`. Component/route tests are deliberately absent — see the "今回やらないこと" note in
the refactor plan.

## Outputs to know about

- `done.log` — append-only list of successfully imported markdown file paths (one per line). Re-runs skip files already listed.
- `failed.json` — JSONL of `{file, error}` for files that exhausted retries. Inspect after every full `import`.
- `parsed.json` — large (~5MB) snapshot from `aube run parse`; safe to delete and regenerate.

## Web app (`app/`)

TanStack Start + React 19 + Mantine 9, deployed on Vercel. Commands go through `vp` (Vite+):
`vp dev` / `vp check` / `vp test` / `vp build`. Never call `pnpm` / `npm` directly.

Four decisions are load-bearing — changing them means changing more than one file:

- **Single user by design.** `ALLOWED_NOTION_EMAIL` gates login, and `mind_map` has **no `user_id`
  column**. A column would imply a "always filter by user" promise nobody enforces (and `getMindMapFn`
  did not). Multi-user is blocked at a deeper level anyway: `src/notion-client.ts` builds one module
  level `new Client()`, so the Notion token is global to the process.
- **CSR is explicit.** Routes have no `loader`; data is fetched client-side under
  `ClientOnly` + `Suspense`. Adding a loader that preloads a collection doubles the Notion round
  trips (the client fetches again) and lets the server touch a module-singleton collection.
- **Auth lives in server-fn middleware.** Every server fn is
  `createServerFn(...).middleware([authMiddleware])`; the session arrives via `context.session`.
  Route `beforeLoad` only guards page navigation — server fns are plain HTTP endpoints and it cannot
  protect them. The allowed-account check exists once, in `getAllowedSession()` (`app/src/lib/auth.ts`).
- **`app/src/start.ts` must keep the CSRF middleware.** TanStack Start auto-applies a default CSRF
  request middleware *only while no start entry exists*. Now that `start.ts` exists, removing
  `csrfMiddleware` from `requestMiddleware` silently unprotects every server fn.

Other things worth knowing:

- `verbatimModuleSyntax` is on and `typescript/consistent-type-imports` is an error. Type-only
  imports must say `import type` — this is what keeps the Notion CLI stack out of the client bundle.
- DB migrations: `cd app && pnpm exec drizzle-kit generate` (schema in `app/src/lib/db/`).
  Back up `mind_map` before running `migrate` against the live Turso database.

## `.claude/`

- `.claude/skills/` contains symlinks to autoskills (nodejs-best-practices, typescript-advanced-types, nodejs-backend-patterns) tracked in `skills-lock.json`. Don't edit the symlink targets directly.
- Project skills `/safe-import` and `/notion-recover` live in `.claude/skills/<name>/SKILL.md`.

## Agent skills

### Issue tracker

Issues and PRDs live as markdown files under `.scratch/<feature>/` (this is not a git repo — no GitHub/GitLab remote). See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded on each issue's `Status:` line. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
