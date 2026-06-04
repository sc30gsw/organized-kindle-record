---
generated: 2026-06-04T00:00:00Z
source: app/package.json, app/vite.config.ts, app/tsconfig.json, .claude/rules/
mode: auto
---

# §1 スタック

| Layer | Technology | Role |
|---|---|---|
| Runtime | Node.js / Nitro 3.x | SSR + API サーバー |
| Framework | TanStack Start 1.x | フルスタック SSR フレームワーク（サーバー関数含む） |
| Router | TanStack Router 1.x | ファイルベースルーティング（routeTree.gen.ts 自動生成） |
| UI Components | Mantine 9.x | コンポーネントライブラリ（優先順位最高） |
| Styling | Tailwind CSS 4.x | ユーティリティCSS（wrapper/layout 要素のみ。Mantine 内部に干渉しない） |
| Icons | @tabler/icons-react 3.x | アイコンセット |
| Server Data Cache | TanStack Query 5.x | サーバーデータキャッシュ・フェッチ管理 |
| Optimistic Sync | @tanstack/db + @tanstack/react-db | クライアントサイド楽観的同期（collection + mutation） |
| Forms | TanStack Form 1.x | フォーム管理（Standard Schema ネイティブ対応、adapter 不要） |
| Table | TanStack Table 8.x | テーブルコンポーネント |
| Virtualization | TanStack Virtual 3.x | 仮想スクロール |
| Graph Canvas | @xyflow/react 12.x | マインドマップキャンバス（ReactFlow） |
| Validation | Valibot 1.x | スキーマバリデーション（境界のみ使用） |
| Error Handling | better-result 2.x | Result 型エラーハンドリング（`Result.gen` / `Result.tryPromise`） |
| Authentication | better-auth 1.x | 認証（Notion OAuth プロバイダー + 単一ユーザー許可リスト） |
| ORM | Drizzle ORM + drizzle-kit | DB スキーマ定義・マイグレーション |
| DB Driver | @libsql/client + kysely-libsql | libSQL (SQLite/Turso) クライアント |
| External API | @notionhq/client 5.x | Notion データ同期（本・ハイライト取得） |
| Date/Time | @formkit/tempo 1.x | 日付操作 |
| Build | vite-plus (Vite ラッパー) | ビルドツール（`vp` コマンド経由で使用） |
| Bundler | Rolldown (via @rolldown/plugin-babel) | 高速バンドラー |
| Compiler | babel-plugin-react-compiler | React 自動メモ化コンパイラ（手動 `useMemo`/`useCallback` 禁止） |
| Type Check | TypeScript 6.x | 型チェック（strict: true） |
| Lint | oxlint (vite-plus 内蔵) | リンター |
| Format | oxfmt (vite-plus 内蔵) | フォーマッター |
| Testing | Vitest (vite-plus 内蔵) | ユニットテスト（`vp test` / `import from 'vite-plus/test'`） |
| Dead Code | fallow 2.x | 未使用コード・循環依存・複雑度検出 |
| Layout | react-resizable-panels 4.x | リサイズ可能スプリットビュー |
| Concurrency | p-limit 7.x | 非同期タスク並行数制限 |

# §2 Design Viewpoints

すべての `design.md` はこれらのセクションを必ず持つ。

| Viewpoint | design.md セクション | 説明 |
|---|---|---|
| Component Architecture | コンポーネント階層 | Mantine + XY Flow の合成構造・責務分離 |
| Data Flow | データフロー | TanStack Query / TanStack DB 楽観的同期・サーバー関数の流れ |
| Server-Client Boundary | サーバー–クライアント境界 | TanStack Start サーバー関数・SSR 境界・シリアライズ制約 |
| Authentication & Authorization | 認証・認可 | better-auth ルートガード・単一ユーザー許可リスト |
| Database Schema | データベーススキーマ | Drizzle テーブル定義・マイグレーション戦略 |
| Feature Boundaries | フィーチャー境界 | モジュール分離ルール・フィーチャー間依存禁止 |
| Error Propagation | エラー伝播 | better-result Result 型伝播パターン・境界での変換 |

# §3 Conventions

詳細は `.claude/rules/` を参照。以下は主要ポイント。

| Category | Rule | Source |
|---|---|---|
| エラー処理 | `better-result` を使用。`Result.gen` / `Result.tryPromise` で境界ラップ。`unwrap()` は証明済みの場合のみ | `.claude/rules/typescript/better-result.md` |
| バリデーション | Valibot を境界のみで使用（`features/*/schemas/`）。内部データ変換には追加しない | `.claude/rules/typescript/valibot-validation.md` |
| インポートエイリアス | `@/` = `app/src/*`（web app 内部、通常これを使う）。`~/` = root `src/*`（CLI/Notion インポーター専用）。相対パス禁止 | `.claude/rules/typescript/project-structure.md` |
| コンポーネント形式 | 関数宣言 + 名前付き export のみ（`src/routes/` と `*.config.ts` を除く） | `.claude/rules/typescript/react-conventions.md` |
| UI スタイリング | Mantine props 優先 → Tailwind は wrapper/layout 要素のみ。`cn()` を使用 | `.claude/rules/web/mantine-tailwind.md` |
| メモ化 | 手動 `useMemo`/`useCallback` 禁止（React Compiler が自動化） | `.claude/rules/typescript/react-conventions.md` |
| フィーチャー間依存 | フィーチャーが別フィーチャーを直接インポート禁止。共有は `src/components/` へ | `.claude/rules/typescript/project-structure.md` |
| コメント | 日本語で記述。「なぜ」が自明でない場合のみ追加 | `CLAUDE.md` |
| ファイルサイズ | 800行上限。一責務一ファイル | `.claude/rules/common/coding-style.md` |

# §4 Verification Commands

```bash
vp check                    # format + lint + typecheck（PR 前必須）
vp test                     # Vitest ユニットテスト
vp build                    # production build 確認
vp run fallow:dead-code     # 未使用ファイル・exports・依存関係検出
vp run doctor               # React ヘルスチェック
npx drizzle-kit generate    # DB スキーマからマイグレーション生成
npx drizzle-kit migrate     # マイグレーション適用
```

<!-- MANUAL:START -->
<!-- MANUAL:END -->
