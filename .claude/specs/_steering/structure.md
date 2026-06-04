---
generated: 2026-06-04T00:00:00Z
source: app/src/
mode: auto
---

# ソース構造

## トップレベル

```
app/src/
├── components/        # フィーチャー横断の共有コンポーネント
├── features/          # ビジネスロジック（ドメイン別）
├── lib/               # インフラ・横断関心事
├── routes/            # TanStack Router ファイルベースルート
├── router.tsx         # ルーター設定
├── styles.css         # グローバルスタイル
└── routeTree.gen.ts   # 自動生成（編集禁止）
```

## モジュール一覧

| Module | Path | 公開シンボル（主要） |
|---|---|---|
| split-view | `src/components/split-view.tsx` | `SplitView` |
| books collections | `src/features/books/collections.ts` | `booksCollection` (TanStack DB) |
| books API | `src/features/books/api/book-highlights-query.ts` | ハイライトクエリオプション |
| books components | `src/features/books/components/` | `BooksPage`, `BooksTable`, `BooksSearchForm`, `HighlightPanel`, `ImportModal`, `ImportResultPanel`, `MentalMapModal`, `StatusBadge` |
| books errors | `src/features/books/errors.ts` | books ドメインエラー型 |
| books hooks | `src/features/books/hooks/use-books-query.ts` | `useBooksQuery` |
| books schemas | `src/features/books/schemas/book-schema.ts` | `bookRowSchema`, `BookRowValues` |
| books schemas | `src/features/books/schemas/search-schema.ts` | 検索フォームスキーマ |
| books server fns | `src/features/books/server/` | `getBookDetailFn`, `importBooksFn`, `listBooksFn` |
| mind-map collections | `src/features/mind-map/collections.ts` | `mindMapCollection` (TanStack DB + 楽観更新) |
| mind-map canvas | `src/features/mind-map/components/mind-map-canvas.tsx` | `MindMapCanvas` |
| mind-map toolbar | `src/features/mind-map/components/mind-map-toolbar.tsx` | `MindMapToolbar` |
| mind-map nodes | `src/features/mind-map/components/nodes/` | `TextNode`, `TitleNode`, `NodeActions` |
| mind-map hooks | `src/features/mind-map/hooks/use-mind-map.ts` | `useMindMap` |
| mind-map schemas | `src/features/mind-map/schemas/mind-map-schema.ts` | `mindMapGraphSchema`, `mindMapRowSchema`, `MindMapRowValues` |
| mind-map schemas | `src/features/mind-map/schemas/wheel-mode-schema.ts` | ホイールモードスキーマ |
| mind-map server fns | `src/features/mind-map/server/` | `getMindMapFn`, `saveMindMapFn` |
| auth | `src/lib/auth.ts` | `auth` (betterAuth instance), `isAllowedEmail` |
| auth client | `src/lib/auth-client.ts` | クライアントサイド auth ヘルパー |
| auth functions | `src/lib/auth-functions.ts` | サーバーサイド auth ユーティリティ（詳細未確認 → Q-003） |
| db | `src/lib/db/index.ts` | `db` (Drizzle インスタンス) |
| db schema | `src/lib/db/schema.ts` | `mindMap` (table), `MindMapRow`, `MindMapGraph`, `JsonValue` |
| auth schema | `src/lib/db/auth-schema.ts` | `user`, `session`, `account`, `verification` (Drizzle tables + relations) |
| query client | `src/lib/query-client.ts` | `queryClient` |

## DB テーブル構造

### `mind_map`（`src/lib/db/schema.ts`）

| Column | Type | Notes |
|---|---|---|
| book_id | TEXT (PK) | Notion ページ ID |
| user_id | TEXT | better-auth ユーザー ID |
| graph | TEXT (JSON) | `MindMapGraph` — nodes/edges/viewport |
| updated_at | INTEGER | Unix timestamp (ms) |

### better-auth テーブル群（`src/lib/db/auth-schema.ts`）

`user`, `session`, `account`, `verification` — better-auth の標準スキーマ。直接変更禁止。

## ルート構造

```
src/routes/
├── __root.tsx                       # ルートレイアウト（QueryClient, MantineProvider）
├── _authenticated.tsx               # 認証ガードレイアウト（未認証 → /login）
├── _authenticated/
│   ├── index.tsx                    # 本一覧ページ
│   └── books/$bookId.tsx            # 本詳細 + ハイライト + マインドマップ
├── api/
│   └── auth/$.ts                    # better-auth API ハンドラー（全 OAuth エンドポイント）
└── login.tsx                        # Notion OAuth ログインページ
```

<!-- MANUAL:START -->
<!-- MANUAL:END -->
