---
description: Bulletproof React features/* layout, ~ alias, feature inter-dependencies
globs: ["src/**/*.{ts,tsx}"]
alwaysApply: true
---

# Project Structure

> This rule extends [CODING_GUIDELINES.md](../CODING_GUIDELINES.md) §プロジェクト構造.

## Feature layout

```
src/
├── features/          # Business logic — one module per domain
│   └── [feature]/
│       ├── api/       # Query/mutation wrappers (wraps generated SDK)
│       ├── components/
│       ├── hooks/
│       ├── schemas/   # Valibot schemas
│       ├── stores/    # Jotai atoms
│       ├── types/     # Type definitions (derived from generated types)
│       └── mocks/     # MSW handlers for tests
├── routes/            # TanStack Router file-based routing (minimal logic)
├── lib/
│   ├── api/
│   │   ├── client.ts       # ky configuration (centralized)
│   │   └── generated/      # Auto-generated — NEVER edit manually
│   └── theme.ts
└── styles.css
```

`src/components/`, `src/hooks/`, `src/stores/`, `src/utils/` are created on demand when something is genuinely shared across features.

## Import aliases (relative paths forbidden)

> Also enforced by PostToolUse hook in `.claude/settings.json`

Two aliases are configured in `tsconfig.json`:

| Alias | Resolves to | Use for |
|---|---|---|
| `@/*` | `app/src/*` | **web app 内部インポート（通常これを使う）** |
| `~/*` | root `src/*` | root の CLI/Notion インポーターコードへのインポート専用 |

```typescript
// CORRECT: web app internal imports → @/
import { useBooksQuery } from "@/features/books/hooks/use-books-query";
import type { BookRowValues } from "@/features/books/schemas/book-schema";

// CORRECT: root src (CLI importer) → ~/
import { listBooks } from "~/list-books";
import { parseMdContent } from "~/parse-md";

// WRONG: relative paths — forbidden even within the same directory
import { useBooksQuery } from "../hooks/use-books-query";
import { helper } from "./helper";
```

## Feature inter-dependencies forbidden

```typescript
// WRONG: feature importing directly from another feature
// src/features/books/components/book-form.tsx
import { MindMapCanvas } from "@/features/mind-map/components/mind-map-canvas";

// CORRECT: extract to src/components/
import { MindMapCanvas } from "@/components/mind-map-canvas";
```

## Routes exception

Route files (`src/routes/**/*.tsx`) use `export const Route = createFileRoute(...)`. The oxlint `no-default-export` rule is overridden for this path in `vite.config.ts`.

```typescript
// src/routes/products.tsx — named export is sufficient, no default export needed
export const Route = createFileRoute("/products")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(getProductsOptions({ query: { limit: 20 } })),
  component: ProductsPage,
});
```
