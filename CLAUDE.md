# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`kindle-to-notion` — a one-maintainer TypeScript importer that ingests Glasp-exported Kindle highlight markdown files from `Glasp Kindle Highlights/` and writes them as pages into a Notion database. Not a git repository; not versioned for distribution.

## Runtime & tools

- Run TS directly with `tsx` (no build step). All entry points live in `src/`.
- `package.json` `"type": "module"` — sources are ESM.
- `tsconfig.json` uses `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, `strict: true`. Honor strict mode in new code.
- `mise.toml` pins `aube` (package manager; lockfile: `aube-lock.yaml`). It is not in the mise registry; do not try to `mise install` it. Use `aube install` / `aube add` instead of npm.

## Required env

Loaded by `dotenv` from `.env` at the project root:

- `NOTION_TOKEN` — Notion integration token with insert + update access to the target page.
- `NOTION_TARGET_PAGE_ID` — Parent page where `create-db` provisions the database. The created database ID is written to `db-id.txt` (gitignored) and read back by subsequent runs.

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

**Safe import order is `parse` → `pilot` → `import`.** Skipping `pilot` risks creating hundreds of malformed pages under live Notion rate limits. Use the `/safe-import` skill to enforce this sequence. After failures, use `/notion-recover`.

## Notion API gotchas

These are baked into `src/notion-client.ts` and `src/import-book.ts`. Don't undo them without understanding why:

- **Retry**: `withRetry()` does exponential backoff (2s, 4s, 8s) on 429 / network errors, max 3 attempts. After that, the file path goes to `failed.json`.
- **Concurrency**: `p-limit(3)`. Notion's per-integration rate limit punishes higher concurrency; raise only with deliberate testing.
- **100-block limit**: A `pages.create` call accepts ≤100 children blocks. Highlights beyond 100 are appended in follow-up `blocks.children.append` batches of 100.
- **2000-char rich text limit**: `chunkText()` splits long highlights across multiple rich-text objects within a single block.
- **ASIN deduplication**: The importer queries the database by ASIN before creating a page. Removing this check will duplicate every book on the next run.

## Markdown parser is strict

`src/parse-md.ts` assumes the exact Glasp export shape: `# {title}`, `- Author: {authors}`, `### Highlights & Notes`, `> {quote}` blocks each optionally followed by `- {note}` bullets, with an ASIN-bearing Kindle link. New input formats need parser changes, not workarounds in the importer.

## Code style

- File names are `kebab-case.ts` (existing examples: `import-all.ts`, `notion-client.ts`).
- Treat data as immutable — return new objects instead of mutating. `Book` / `Highlight` の canonical 定義は `ReturnType<typeof parseMd>` として `src/types/index.ts` から export される。関数引数は `Parameters<T>` や `Book['field']` で SSoT を参照し、ローカルに再宣言しない。
- Prefer `Result`-style returns over `try`/`catch` in new code (per user's global rules). `withRetry()` in `notion-client.ts` is the existing exception — leave it alone.
- Comments and user-facing log strings are Japanese throughout; keep new strings consistent with the surrounding file.
- No test framework is configured. If you add one, propose it to the user first.

## Outputs to know about

- `done.log` — append-only list of successfully imported markdown file paths (one per line). Re-runs skip files already listed.
- `failed.json` — JSONL of `{file, error}` for files that exhausted retries. Inspect after every full `import`.
- `parsed.json` — large (~5MB) snapshot from `aube run parse`; safe to delete and regenerate.

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
