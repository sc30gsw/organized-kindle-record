# kindle-to-notion

Glasp 経由でエクスポートした Kindle ハイライト Markdown を、Notion DB「**Kindle 読書記録**」に一括インポートする CLI ツール。

- 書名・著者・ASIN・カバー画像・最終更新日などをプロパティとして保存
- 各ハイライトを Quote ブロックとして本文に展開、メモは直下の bullet で紐付け
- ASIN ベースの重複スキップで再実行しても安全（idempotent）
- 新規ハイライトだけを既存ページに追記する差分更新モード

**動作環境**: Node.js 20+ / TypeScript（`tsx` でランタイム実行、ビルド不要）

---

## 仕組み

```
Kindle で読書 → Glasp でハイライトを同期
       ↓
Glasp の My Highlights からエクスポート（Markdown zip）
       ↓
Glasp Kindle Highlights/*.md（本 1 冊 = 1 ファイル）
       ↓
[src/parse-md.ts] パース
       ↓
[@notionhq/client] Notion API 呼び出し
       ↓
Notion DB「Kindle 読書記録」（個人ワークスペース）
```

---

## 事前準備

### 1. Glasp で Kindle ハイライトをエクスポート

1. [glasp.co](https://glasp.co) にログインし、Kindle と連携する
2. プロフィール → **Library** → Kindle タブ → **Export** → **Markdown** を選択
3. ダウンロードした zip を展開し、展開後のフォルダ名を `Glasp Kindle Highlights` にリネーム
4. そのフォルダをこのプロジェクトのルートに配置する

```
notion-project/
└── Glasp Kindle Highlights/
    ├── 書名A.md
    ├── 書名B.md
    └── ...
```

### 2. Notion Internal Integration を作成

1. [notion.so/profile/integrations](https://www.notion.so/profile/integrations) を開く
2. **New integration** をクリック
3. 設定:
   - **Type**: Internal
   - **Associated workspace**: 個人ワークスペース（会社アカウントと混同しないように注意）
   - **Capabilities**: Read content / Insert content / Update content をすべて ON
4. **Internal Integration Secret**（`ntn_...` または `secret_...` 形式）をコピーして控えておく

### 3. Notion で親ページを作成し Integration を追加

1. Notion で空のページを新規作成（例: ページ名「Kindle」）
2. ページ右上の「**…**」→ **Connections** → 手順 2 で作成した Integration を選択して追加
3. ページ URL を確認する
   - 例: `https://www.notion.so/MyWorkspace/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - 末尾の 32 桁の英数字が `NOTION_TARGET_PAGE_ID`

---

## セットアップ

```bash
# 依存インストール
npm install

# .env を作成
cp .env.example .env   # または手書きで以下の内容を作成
```

`.env` の内容:

```
NOTION_TOKEN=ntn_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_TARGET_PAGE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> **注意**: `.env` は `.gitignore` 済みです。絶対にコミットしないでください。

---

## 使い方

### 基本コマンド

| コマンド | 内容 |
| --- | --- |
| `npm run parse` | MD をパースして `parsed.json` に出力。Notion 未接続でも実行可能（検証用） |
| `npm run create-db` | DB「Kindle 読書記録」を作成（既存なら再利用） |
| `npm run pilot` | 代表 4 冊だけインポート（動作確認用） |
| `npm run import` | 全件インポート（ASIN で重複スキップ） |
| `npm run update:dry` | 各本の差分ハイライトを検出のみ（Notion への書き込みなし） |
| `npm run update` | 差分ハイライトのみ末尾に追記（既存ページ・タグは保持） |
| `node_modules/.bin/tsx src/reorder.ts` | 全ページを最終更新日 DESC で並び替え（archive + 再作成） |

### 追加オプション

```bash
# インポート件数を絞る
npm run import -- --limit 10

# 1 冊だけ差分更新（ASIN 指定）
npm run update -- --asin B09XXXXXXXX

# 1 冊だけ差分更新（ファイル名指定）
npm run update -- --file "世界一流エンジニアの思考法 (文春e-book).md"
```

### 推奨ワークフロー（初回）

```bash
# 1. パースのみ確認（parsed.json で内容確認）
npm run parse

# 2. DB を作成
npm run create-db

# 3. 4 冊で動作確認
npm run pilot

# 4. Notion で 4 冊を目視確認してから全件インポート
npm run import
```

### 推奨ワークフロー（Glasp で新しいハイライトを追加した後）

```bash
# 1. Glasp から再エクスポートして Glasp Kindle Highlights/ を更新

# 2. 差分を確認
npm run update:dry

# 3. 差分を追記
npm run update
```

---

## プロジェクト構成

```
.
├── .env                          # 認証情報（コミットしない）
├── .env.example                  # .env のサンプル
├── .gitignore
├── package.json
├── tsconfig.json
├── Glasp Kindle Highlights/      # MD ファイル一式（gitignore 推奨）
└── src/
    ├── parse-md.ts               # MD → Book 構造体に変換
    ├── notion-client.ts          # Notion SDK ラッパー（retry, chunkText）
    ├── create-database.ts        # DB 作成・既存検索（idempotent）
    ├── import-book.ts            # 1 冊を Notion ページとして書き込む
    ├── import-all.ts             # 一括インポートエントリ
    ├── update-highlights.ts      # 差分ハイライトのみ追記
    └── reorder.ts                # 並び替え（全件 archive + 日付順再作成）
```

---

## Notion DB スキーマ

| プロパティ | 型 | 内容 |
| --- | --- | --- |
| タイトル | Title | 書名 |
| 著者 | Multi-select | 著者（共著対応。`and`・`、`・`,`・`&` で分割） |
| ASIN | Rich text | Amazon 商品 ID（重複判定キー） |
| Amazon URL | URL | Amazon 商品ページ URL |
| Kindle Link | URL | `kindle://book/?action=open&asin=...` |
| 最終更新日 | Date | MD の "Last Updated on" 日付 |
| ハイライト件数 | Number | Quote ブロック数 |
| 読了ステータス | Select | 未読 / 読書中 / 読了 / 再読（デフォルト: 読了） |
| タグ | Multi-select | 手動分類用（初期値: 空） |
| Cover URL | URL | Amazon カバー画像 URL |

各本ページの本文構造:

```
### Highlights & Notes   ← heading_3

> ハイライト本文          ← quote ブロック
  - 自分のメモ           ← quote の子 bullet（メモがある場合のみ）

> 次のハイライト本文
```

---

## MD ファイル仕様（Glasp エクスポート形式）

```markdown
# 書名

![](https://m.media-amazon.com/images/I/xxxxL.jpg)

### Metadata
- Title: 書名
- Author: 著者A and 著者B
- Book URL: https://www.amazon.com/dp/XXXXX
- Open in Kindle: [...](kindle://book/?action=open&asin=XXXXX)
- Last Updated on: 2024年10月6日日曜日

### Highlights & Notes

> ハイライト本文...

- 自分のメモ（ハイライトへの注釈、任意）

> 次のハイライト本文...
```

---

## トラブルシュート

| エラー / 症状 | 原因 | 対処 |
| --- | --- | --- |
| `object_not_found` | 親ページへの Integration Connection 未設定 | ページの「…」→ Connections → Integration を追加 |
| `unauthorized` | NOTION_TOKEN が誤りまたは期限切れ | Integration 設定ページから Secret を再発行 |
| `429 rate_limited` | Notion API のレート制限（3 req/sec） | `withRetry` が自動リトライ（最大 3 回、指数バックオフ）するので待つ |
| 既存の本がスキップされる | ASIN による重複判定（正常動作） | Notion 側でページを削除してから再実行すると取り込み直せる |
| `service_unavailable` で一部失敗 | Notion サーバー一時障害 | 同じコマンドを再実行（idempotent なので重複しない） |
| 並び順を変えたい | パブリック API ではビューソートを変更できない | Notion UI で `Sort → 最終更新日 → Descending` を設定、または `reorder.ts` を実行 |

---

## 設計メモ

- **2000 文字制限**: rich_text item は 1 つあたり最大 2000 文字。`chunkText()` で分割して同一ブロックの rich_text 配列に詰め込む
- **100 ブロック制限**: `pages.create` の `children` は最大 100 件。101 件目以降は `blocks.children.append` でバッチ追記
- **レートリミット対策**: `p-limit(3)` で同時リクエスト数を 3 に絞り、`withRetry` で 429 エラーを指数バックオフでリカバリ
- **冪等性**: ASIN ベースの重複チェックにより、何度実行しても同じ本が二重登録されない
- **並び替え戦略**: パブリック API はビューの並び順設定に非対応。`reorder.ts` は全ページをアーカイブして最終更新日降順で再作成することで、Notion のデフォルト表示順（作成日時順）を利用して望む順序を実現する

---

## 注意事項

- 個人ユース前提のツールです。[Glasp 利用規約](https://glasp.co/terms)・[Notion API 利用規約](https://www.notion.so/notion/Notion-s-API-Terms-of-Service-c8fe09c4e4d44f3aaa9d26d7b51a9b08)を遵守してください
- `.env` に含まれる Integration Secret は外部に漏らさないようにしてください。コミット・シェア禁止
