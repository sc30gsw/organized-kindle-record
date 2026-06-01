# Kindle → Notion UI (`app/`)

TanStack Start (SSR) web UI for the `kindle-to-notion` importer. Lists books from the
Notion DB and lets you upload Glasp `.md` files to create/append into Notion.

It reuses the parent CLI's server logic directly (`../src/*`) via server functions, so
`NOTION_TOKEN` never reaches the browser.

## Prerequisites

The server functions load the parent's modules, which read `.env` via `dotenv` from the
process cwd. Provide the same env to this app — easiest is a symlink:

```sh
cd app
ln -s ../.env .env        # NOTION_TOKEN, NOTION_TARGET_PAGE_ID
```

The Notion database is resolved at runtime via `findOrCreateDatabase()` (scans
`NOTION_TARGET_PAGE_ID` for the `Kindle 読書記録` DB).

## Commands

```sh
aube install          # install deps
aube run dev          # dev server (generates src/routeTree.gen.ts on first run)
aube run build        # production build (client + nitro server) — currently green
aube run start        # preview the production build
node_modules/.bin/tsc --noEmit   # typecheck — currently green
```

## Architecture

- **Alias**: `@/*` → `app/src/*` (app code), `~/*` → `../src/*` (parent core). The parent
  core keeps its own `~`→`src` imports, which resolve correctly under this mapping.
- **Data layer**: TanStack DB `booksCollection` (`@tanstack/query-db-collection`, backed by
  `@tanstack/react-query`). `queryFn` → `listBooksFn` server fn → `~/list-books`.
- **Read**: `useLiveSuspenseQuery` filtered by status (DB `where`) + text (JS, title/author OR).
  Route `loader` preloads the collection for first-paint data.
- **Search**: `@tanstack/react-form` → URL search params (`@tanstack/valibot-adapter`),
  one shared valibot schema. Text debounced 300ms, status instant.
- **Upload**: Mantine `Dropzone` in a modal → `importBooksFn` server fn → `parseMdContent`
  + `syncBook` (`~/lib/notion-sync`): new book = `importBook`, existing = append new
  highlights only (status/cover/author preserved). Then `booksCollection.utils.refetch()`.
- **Table**: `@tanstack/react-table` + `@tanstack/react-virtual` (virtual scroll), Mantine UI.

> Server-fn files must NOT use the `.server.ts` suffix — that triggers TanStack's client
> import-protection. They live as `*-fn.ts`; the handler body is still stripped from the
> client bundle.

## Verified vs. needs runtime check

- ✅ Production build, ✅ `tsc --noEmit`.
- ⚠️ Not yet exercised at runtime (needs `.env` + live Notion): Mantine SSR hydration,
  virtualized-table row layout (the absolute-positioned rows in a semantic `<table>` may
  need tuning), `booksCollection.preload()` timing on SSR, and `.env` cwd resolution.

## Cleanup

Two deprecated empty files remain because `rm` was blocked for the agent — delete them:

```sh
rm app/src/features/books/server/list-books.server.ts
rm app/src/features/books/server/import-books.server.ts
```
