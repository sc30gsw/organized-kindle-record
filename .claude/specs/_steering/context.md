---
last-grilled: 2026-06-04
mode: manual
---

# ドメイン用語集

### Book（本）

Kindle で読んだ本の記録。Notion データベースの1ページに対応。`id` は Notion ページ ID、`amazonUrl` / `kindleLink` で元書籍を参照。

<!-- DRAFT 2026-06-04 -->

### Highlight（ハイライト）

Kindle でマークした引用テキスト。Glasp でエクスポートした Markdown から抽出し、Notion に保存。Book に属する。`highlightCount` で冊ごとの件数を管理。

<!-- DRAFT 2026-06-04 -->

### MindMap / MindMapGraph（マインドマップ）

本ごとの読書ノートをビジュアル化したグラフ。@xyflow/react（ReactFlow）で描画。DB には `mind_map` テーブルに1冊1行で保存。`graph` カラムに nodes / edges / viewport を JSON で格納。

<!-- DRAFT 2026-06-04 -->

### MentalMap（メンタルマップ）

Glasp エクスポートの H2 セクションから抽出した構造化ハイライトデータ。各エントリは `question`（H2 見出し）と `answers`（その配下のハイライト）のペアで構成される。読み取り専用。`MentalMapModal` で一覧表示し、「ノード化」ボタンで MindMap キャンバスのノードに変換できる。`MindMap`（XY Flow キャンバス）とは別概念。

### Session（セッション）

`getSession` / `ensureSession` の2つのサーバー関数（`src/lib/auth-functions.ts`）で取得する。`getSession` は未認証時 null 返却（任意認証）、`ensureSession` は未認証時 throw（必須認証）。`auth.ts` が betterAuth インスタンスの設定、`auth-functions.ts` が呼び出し可能なサーバー関数を提供する役割分担。

### Server Function（サーバー関数）

TanStack Start の `createServerFn()` で定義するサーバーサイド処理。`*-fn.ts` の命名規則。クライアントから RPC 的に呼び出せる。シリアライズ可能な値のみ返却可。

<!-- DRAFT 2026-06-04 -->

### Collection（コレクション）

TanStack DB の `createCollection()` で作成するクライアントサイドストア。TanStack Query とブリッジし、楽観的更新（onInsert / onUpdate）を実装する。`booksCollection`（読み取り中心）と `mindMapCollection`（読み書き）が存在。

<!-- DRAFT 2026-06-04 -->

### TanStack DB Mutation（楽観的更新）

`mindMapCollection` の onInsert / onUpdate フックがサーバー関数を呼び出しつつ、UI をすぐに更新する仕組み。失敗時はロールバック。

<!-- DRAFT 2026-06-04 -->

### Notion OAuth（Notion 認証）

better-auth の socialProviders.notion で実装。`ALLOWED_NOTION_EMAIL` 環境変数で単一ユーザーに限定。それ以外は FORBIDDEN エラーを返す。

<!-- DRAFT 2026-06-04 -->

### JsonValue

`MindMapGraph` の nodes/edges は ReactFlow の `toObject()` 出力をそのまま保存するため、型は `JsonValue[]`（再帰的 JSON 型）。TanStack Start のシリアライズ検査を通すために `unknown` を避けている。

<!-- DRAFT 2026-06-04 -->
