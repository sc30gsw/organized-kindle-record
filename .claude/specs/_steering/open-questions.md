---
generated: 2026-06-04T00:00:00Z
mode: auto
---

# Open Questions

## Open

_（現時点でオープンな質問なし）_

## Resolved

### Q-001: インポートエイリアス不一致（`~/` vs `@/`）

- Detected from: `src/features/books/collections.ts`, `src/features/mind-map/schemas/mind-map-schema.ts` 他
- Detected on: 2026-06-04
- Resolved on: 2026-06-04
- Resolution: `tsconfig.json` で両エイリアスが意図的に定義されている。`@/*` → `app/src/*`（web app 内部）、`~/*` → root `src/*`（CLI/Notion インポーター）。ルール文書を修正し、`@/` を web app 内部インポートの正式エイリアスとして明記。

### Q-002: "MentalMap" vs "MindMap" — 用語の二重化

- Detected from: `src/features/books/components/mental-map-modal.tsx`, `src/features/mind-map/`
- Detected on: 2026-06-04
- Resolved on: 2026-06-04
- Resolution: 別概念。`MentalMap` = Glasp の H2 構造化ハイライト（question/answers ペア、読み取り専用）。`MindMap` = ユーザーが編集する XY Flow キャンバス（DB 保存）。`MentalMapModal` の「ノード化」ボタンが MentalMap → MindMap ノードへの変換を担う。命名は正しい。context.md に両用語を追記。

### Q-003: `src/lib/auth-functions.ts` — 責務不明

- Detected from: `src/lib/auth-functions.ts`
- Detected on: 2026-06-04
- Resolved on: 2026-06-04
- Resolution: `getSession`（null 返却）と `ensureSession`（throw）の2つの TanStack Start サーバー関数を export。`auth.ts` が betterAuth インスタンス設定、`auth-functions.ts` が呼び出し可能なサーバー関数という役割分担。context.md に Session エントリを追記。

### Q-004: `tailwind-preset-mantine` がルールに記載されているが package.json に不在

- Detected from: `.claude/rules/web/mantine-tailwind.md`, `app/package.json`
- Detected on: 2026-06-04
- Resolved on: 2026-06-04
- Resolution: Tailwind v4 は `tailwind-preset-mantine` 不要。`styles.css` で `tailwindcss/theme.css` + `tailwindcss/utilities.css` を直接インポート（preflight 除外で Mantine との競合回避）。ルール文書の例は v3 時代のもので、実装は正しい。ルール文書の `tailwind-preset-mantine` 言及は削除対象（任意）。
