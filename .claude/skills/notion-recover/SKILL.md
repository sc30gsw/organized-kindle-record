---
name: notion-recover
description: Triage and recover from failed Notion imports. Use when the user asks about `failed.json`, mentions import failures, asks to retry failed books, or after `/safe-import` reports non-empty failures.
---

You are recovering from a partial Notion import. The importer is resumable: `done.log` records successes, `failed.json` records files that exhausted retries. Re-running `npm run import` will skip everything already in `done.log` and retry the rest.

## Step 1 — Read the failure record

Read `failed.json` (JSONL: one `{"file": "...", "error": "..."}` per line). Group the entries by error class:

- **Timeout / network** (`"Request to Notion API has timed out"`, `ETIMEDOUT`, `ECONNRESET`) — usually transient. Safe to retry by re-running the importer; `withRetry()` will try 3 times again.
- **Rate limit** (`429`, `"rate_limited"`) — Notion is throttling. Wait 1–2 minutes, then retry. Do not increase concurrency.
- **Validation** (`validation_error`, `"body failed validation"`) — the markdown produced a payload Notion rejects. The source file needs a parser-level fix in `src/parse-md.ts` or a manual edit to the markdown. Do not retry blindly.
- **Auth / permission** (`unauthorized`, `restricted_resource`) — `.env` token or target page sharing. Fix the integration before retrying anything.
- **Unknown** — report verbatim, do not guess.

Show the user the grouped summary before doing anything else.

## Step 2 — Choose a recovery path

- **All-transient batch** → confirm with the user, then `npm run import` again. It will skip `done.log` entries and retry the rest. After it finishes, re-read `failed.json` to see what remains.
- **Mixed transient + validation** → re-import will keep retrying validation failures and they will fail again. Recommend fixing the validation entries first (edit the markdown or `src/parse-md.ts`), then re-import.
- **All validation / auth** → do not re-import. Fix the underlying problem.

## Step 3 — Reset `failed.json` between attempts

`failed.json` is append-only within a run but the user may want a clean record across runs. Confirm before truncating it; once cleared, you cannot recover the prior error list except by re-running.

## Do not

- Do not delete entries from `done.log` to "force a retry" of a file that already imported — it will create a duplicate page. If a successfully imported page is broken in Notion, delete the Notion page first, then remove that line from `done.log`.
- Do not blindly loop `npm run import`. If a file fails the same way twice, escalate to the user.
