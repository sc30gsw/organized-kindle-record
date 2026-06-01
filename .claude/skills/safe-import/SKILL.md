---
name: safe-import
description: Enforce the parse → pilot → import sequence before any full Notion batch import. Use whenever the user asks to "import", "run the importer", "import everything", or any phrasing that implies running `npm run import` directly.
---

You are guarding live Notion writes. A full `npm run import` will hit the API for hundreds of pages under rate limits. The maintainer requires a three-step safety sequence; do not skip it.

## Step 1 — Parse (dry-run, no writes)

Run `npm run parse`. This regenerates `parsed.json` and prints any per-file warnings (missing ASIN, no highlights, multiple authors, malformed sections).

- If the run produces warnings, stop and show them to the user. Ask whether to fix the source markdown or proceed anyway. Do not auto-proceed.
- If `parsed.json` already exists from a recent run and the user confirms the input set hasn't changed, you may skip this step — but always confirm explicitly.

## Step 2 — Pilot (4 books, real writes)

Run `npm run pilot`. This imports only the first 4 books into Notion. Then:

1. Read `done.log` to confirm 4 successful entries were appended.
2. Read `failed.json`. If it is non-empty, **stop**. Walk the user through `/notion-recover` instead of proceeding.
3. Ask the user to verify the pilot pages in Notion (cover, authors, ASIN, highlight ordering) before continuing. Wait for explicit confirmation.

## Step 3 — Full import

Only after the pilot is verified by the user, run `npm run import`. While it runs:

- It will append every successful file to `done.log` and any retry-exhausted file to `failed.json`. Re-runs automatically skip files already in `done.log`.
- After the run, read `failed.json` and surface any failures. Recommend `/notion-recover` if it is non-empty.

## Do not

- Do not run `npm run import` directly without steps 1 and 2.
- Do not delete `done.log` or `db-id.txt` to "start over" — that creates duplicates in Notion. Use `src/reorder.ts` only after confirming with the user.
- Do not raise the `p-limit(3)` concurrency to speed things up.
