# Database — 対応DB網羅 + アダプタ

> Better Auth は内部で **Kysely**（型安全な SQL クエリビルダ）を使うため、リレーショナル DB なら基本的にそのまま動く。RDB は組み込みアダプタで直結、ORM を使うなら Drizzle / Prisma アダプタ、NoSQL なら MongoDB アダプタを噛ませる。この章では各 DB / プロバイダを「種別・際立つ特徴・運用形態・認証ストアとしての向き不向き・いつ選ぶか」の観点で掘り下げ、アダプタの選び分け、`modelName` の意味、CLI の使い分け、そして最後に**選び方早見表**を置く。

### 🎤 登壇メモ

- **つかみ**: 「DB はどれに対応してる？」と聞かれたら一言で返す ——「**内部で Kysely を使ってるから、リレーショナル DB ならだいたい動く**」。対応表の暗記は要らない、という掴み。
- **強調**: ① アダプタは実質4系統だけ（組み込み Kysely / Drizzle / Prisma / MongoDB）。② `modelName` は **DB のテーブル名ではなくアダプタのモデル名** —— ここだけは毎回ハマる。③ プラグインを足すたびに `migrate` / `generate` を再実行。
- **10分なら**: 「Kysely 前提」の一言 → `pg.Pool` 直結のコード1枚 → 選び方早見表（サーバーレス / エッジ / エンプラ）→ `modelName` の落とし穴、で締める。詳細な DB 一覧は飛ばして早見表に逃がす。
- **関連章**: 認証連携・OAuth など同テーマは [§04 Integration](04-integrations.html)、Database 概念・コアスキーマ・`modelName` の前提は [§01 Concepts](01-concepts.html)。

---

## 基本方針: 内部は Kysely

Better Auth は DB に接続して `user` / `session` / `account` / `verification` などのコアデータを保存する。プラグインを足すと、そのプラグイン専用テーブルも増える。

最大のポイントは **内部実装が Kysely 依存** だということ。公式ドキュメントも次のように明言している。

> PostgreSQL is supported under the hood via the Kysely adapter, any database supported by Kysely would also be supported.

つまり **Kysely がサポートする DB は Better Auth でもサポートされる**。RDB を選ぶ限り「対応しているか」で悩むことはほぼなく、接続インスタンス（`pg.Pool` など）を `database` に渡すだけで組み込み Kysely アダプタが面倒を見る。Kysely を経由することで得られるのは次の3点。

- **方言（dialect）の差を吸収**: PostgreSQL / MySQL / SQLite / MS SQL の SQL 差異を Better Auth 側が意識しなくて済む。
- **スキーマ生成・マイグレーション**: 組み込みアダプタなら CLI から DDL を直接生成・適用できる（後述）。
- **ORM 非依存**: ORM を入れたくないプロジェクトでも、ドライバのプール一個で完結する。

> DB なしでも動く: ステートレスセッション（JWT ベース）を使えば DB を持たない構成も可能。詳細は session-management のドキュメントを参照。

---

## 各DB / プロバイダ詳細

観点は各項目で統一する: **種別 / 際立つ特徴 / 運用形態 / 認証ストア適性 / いつ選ぶか**。

### 直接接続 / RDB（組み込み Kysely）

ドライバのインスタンスを `database` に直接渡せる王道カテゴリ。CLI の `migrate` がそのまま使えるのもこの層の特権。

#### PostgreSQL

- **種別**: RDB（組み込み）
- **際立つ特徴**: 高機能で堅牢な定番 OSS RDB。JSONB・全文検索・豊富な拡張・厳密なトランザクション。
- **運用形態**: 自前ホスト / 各種マネージド（後述の Supabase・Neon・RDS など実体はこれ）。
- **認証ストア適性**: ◎。Better Auth の事実上の第一候補で、ドキュメント・実績が最も厚い。
- **いつ選ぶか**: 迷ったらこれ。将来プラグインで機能拡張する前提なら堅実。

#### MySQL

- **種別**: RDB（組み込み）
- **際立つ特徴**: 世界的に普及した OSS RDB。エコシステム・ホスティング選択肢が広い。
- **運用形態**: 自前 / マネージド（PlanetScale は MySQL 互換）。`mysql2/promise` の `createPool()` を渡す。
- **認証ストア適性**: ◎。PostgreSQL に次ぐ定番。
- **いつ選ぶか**: 既存スタックが MySQL、または MySQL マネージド（PlanetScale 等）に乗せたいとき。

#### SQLite

- **種別**: RDB（組み込み・単一ファイル）
- **際立つ特徴**: サーバープロセス不要の組込み DB。単一ファイルで完結、セットアップゼロ。
- **運用形態**: アプリと同居（`better-sqlite3` が推奨ドライバ。`node:sqlite` / `bun:sqlite` 等も選べる）。
- **認証ストア適性**: ○（小〜中規模）。高並行な書き込みには不向きだが、個人〜小規模なら十分。
- **いつ選ぶか**: ローカル開発・プロトタイプ・小規模アプリ・エッジ（libSQL/D1 系の素地）。

#### MS SQL

- **種別**: RDB（組み込み・Kysely `MssqlDialect`）
- **際立つ特徴**: Microsoft のエンタープライズ RDB。堅牢なセキュリティ・スケーラビリティ・周辺ツール。
- **運用形態**: `tedious`（ドライバ）+ `tarn`（プール）で Kysely の `MssqlDialect` を構成して渡す。
- **認証ストア適性**: ○。動作はするが設定はやや重め（接続・型マッピングの調整が要る）。
- **いつ選ぶか**: 既存資産が Microsoft / Windows エンタープライズ環境のとき。

#### その他 RDB

- **種別**: RDB（Kysely の任意 dialect）
- **際立つ特徴**: Kysely が対応する dialect なら何でも繋がる。CLI でのスキーマ生成・マイグレーションも効く。
- **運用形態**: 対応する Kysely dialect を自前で組み込む。
- **認証ストア適性**: dialect の成熟度次第。
- **いつ選ぶか**: 上記4種以外の RDB を使う必要があるとき。other-relational-databases ドキュメントを参照。

### マネージド / サーバーレス

実体は上記 RDB のホスティング形態。接続文字列・ドライバが違うだけで、Better Auth から見れば「PostgreSQL / MySQL / SQLite」として扱える。差は**運用特性**（スケール・接続管理・ブランチング）に出る。

#### Supabase

- **種別**: サーバーレス / BaaS（PostgreSQL ベース）
- **際立つ特徴**: Postgres を核に Auth・Storage・Realtime・Edge Functions を同梱した BaaS。
- **運用形態**: **Better Auth では「ただの Postgres」として使う**。Supabase 自身の Auth(GoTrue) は使わず、接続文字列を `pg.Pool` に渡す。サーバーレス環境では Supavisor/PgBouncer 系のプーラ用エンドポイントを使う。
- **認証ストア適性**: ◎（Postgres そのもの）。
- **いつ選ぶか**: Postgres マネージド + ストレージ/リアルタイム等も一緒に欲しいが、認証ロジックは Better Auth で握りたいとき。

#### Neon

- **種別**: サーバーレス（PostgreSQL）
- **際立つ特徴**: ストレージとコンピュートを分離したサーバーレス Postgres。**DB ブランチング**（git のようにコピーオンライトで分岐）と **scale-to-zero**（無アクセス時に停止して課金抑制）。
- **運用形態**: 通常の Postgres 接続に加え、エッジ向けの serverless ドライバ（HTTP/WebSocket）も提供。
- **認証ストア適性**: ◎。サーバーレス関数からの大量接続にも強い。
- **いつ選ぶか**: プレビュー環境ごとに DB を分岐したい / Lambda・サーバーレスで接続枯渇を避けたい / アイドル課金を抑えたいとき。

#### Turso (libSQL)

- **種別**: エッジ / 分散（SQLite 派生 = libSQL）
- **際立つ特徴**: SQLite を fork した libSQL の分散版。**エッジレプリカ**で低レイテンシ読み取り、**多数の DB**（テナントごとに DB を分ける運用）が得意。
- **運用形態**: `@libsql/client` 経由。組込みレプリカでローカル読み取りも可能。
- **認証ストア適性**: ○。読み取りはエッジで速いが、SQLite 由来の書き込み特性は理解しておく。
- **いつ選ぶか**: エッジ配信・マルチテナント（DB-per-tenant）・SQLite の手軽さを分散で活かしたいとき。

#### PlanetScale

- **種別**: サーバーレス（MySQL 互換、**Vitess** ベース）
- **際立つ特徴**: YouTube 由来の Vitess による**水平スケール**。**ブランチング + 非ブロッキングなオンラインスキーマ変更**（deploy request ワークフロー）。
- **運用形態**: MySQL 互換接続。スキーマ変更はブランチを切ってデプロイリクエストで本番へ。歴史的に外部キー制約の扱いに癖があるため、利用前に FK ポリシーを確認。
- **認証ストア適性**: ◎（大規模 MySQL）。
- **いつ選ぶか**: 大規模・高トラフィックの MySQL を無停止スキーマ変更で運用したいとき。

#### Cloudflare D1

- **種別**: エッジ（SQLite 互換）
- **際立つ特徴**: Cloudflare のネットワーク上で動くエッジ SQLite。**Workers とネイティブ統合**。
- **運用形態**: Workers の D1 バインディング（Kysely の D1 dialect 等）で接続。Workers ランタイム前提。
- **認証ストア適性**: ○（Workers アプリ向け）。グローバル書き込み一貫性は SQLite 系の制約を踏まえる。
- **いつ選ぶか**: アプリ全体を Cloudflare Workers で完結させているとき。

#### Prisma Postgres

- **種別**: サーバーレス（PostgreSQL、Prisma マネージド）
- **際立つ特徴**: Prisma が提供するマネージド Postgres。Prisma エコシステム（Accelerate 等）と一体運用。
- **運用形態**: **Prisma アダプタ**経由で接続するのが前提。
- **認証ストア適性**: ◎（Postgres + Prisma 運用に最適化）。
- **いつ選ぶか**: 既に Prisma を使っていて、DB ホスティングも Prisma に寄せたいとき。

#### AWS RDS Data API

- **種別**: サーバーレス（Aurora/RDS への HTTP アクセス）
- **際立つ特徴**: HTTP 経由で RDS/Aurora を叩く。**永続コネクション不要 = コネクションプール不要**。
- **運用形態**: Lambda 等のサーバーレスから、接続数枯渇問題を避けて利用。
- **認証ストア適性**: ○。1リクエストあたりのオーバーヘッドは増えるが、サーバーレスの接続問題が消える。
- **いつ選ぶか**: Lambda + Aurora 構成で、接続プールの枯渇を根本から避けたいとき。

### エッジ / 組込みランタイム

ランタイム同梱・組込みの SQLite 実装。実体は SQLite なので扱いは SQLite に準ずるが、**どのランタイムで動かすか**で実装（ドライバ）が変わる。

#### Deno SQLite

- **種別**: エッジ / 組込み（SQLite）
- **際立つ特徴**: Deno ランタイム向けの SQLite 実装。
- **いつ選ぶか**: Deno でサーバーを書いていて、軽量に組込み DB を持ちたいとき。

#### SQLite WASM

- **種別**: エッジ / 組込み（WASM 版 SQLite）
- **際立つ特徴**: SQLite を WebAssembly にコンパイルしたもの。ネイティブバインディング不要でブラウザ/エッジ/Workers でも動く。
- **いつ選ぶか**: ネイティブモジュールが使えない実行環境（ブラウザ・一部エッジ）で SQLite を使いたいとき。

#### Bun SQLite

- **種別**: エッジ / 組込み（`bun:sqlite`）
- **際立つ特徴**: Bun ランタイム標準の高速ネイティブ SQLite。追加依存なしで使える。
- **いつ選ぶか**: Bun でアプリを書いていて、最速の組込み SQLite が欲しいとき。

### 分析系（用途限定）

OLAP（分析）DB。**認証ストアのメインには非典型・用途限定**で、本番の主データストアにはしない。理由を明記しておく。

#### BigQuery

- **種別**: 分析（サーバーレス OLAP データウェアハウス）
- **なぜ認証ストアに向かないか**: 列指向・追記前提でクエリ単位課金。セッションのような**単一行の点参照・頻繁な更新/削除**が苦手で、レイテンシ・コスト面でトランザクショナルな認証に不向き。
- **いつ使うか**: 認証イベントの**分析・集計**用途に限る。主ストアは別 RDB。

#### ClickHouse

- **種別**: 分析（列指向 OLAP）
- **なぜ認証ストアに向かないか**: 集計は爆速だが、**単一行の更新/削除が弱い**。セッションの作成・失効・更新が頻発する認証ワークロードとは相性が悪い。
- **いつ使うか**: ログイン履歴などの**分析基盤**として。認証本体のストアにはしない。

---

## アダプタの選び分け

Better Auth の `database` に渡すものは大きく4系統。**内部はどれも Kysely か、各 ORM/ドライバ越しに DB へ到達する**。

| アダプタ | 性質 | スキーマ管理 | 向いているケース |
|---|---|---|---|
| 組み込み Kysely | ドライバ直結・最軽量 | CLI `migrate` で直接適用 | ORM を入れたくない |
| Drizzle | 型安全・軽量・SQL 寄り | `generate` 後は自前(drizzle-kit) | 既に Drizzle 採用 |
| Prisma | スキーマ駆動・ツール充実 | `generate` で Prisma スキーマ生成 | 既に Prisma 採用 / 広範な DB |
| MongoDB | NoSQL ドキュメント | スキーマレス（生成不要） | ドキュメント指向 / 既存 Mongo |

### 組み込み Kysely（ドライバ直結）

ORM を使わず、ドライバのインスタンスをそのまま渡す最短ルート。

```ts
import { betterAuth } from "better-auth";
import { Pool } from "pg";

export const auth = betterAuth({
  database: new Pool({
    connectionString: "postgres://user:password@localhost:5432/database",
  }),
});
```

MySQL は `mysql2/promise` のプールを渡す。

```ts
import { betterAuth } from "better-auth";
import { createPool } from "mysql2/promise";

export const auth = betterAuth({
  database: createPool({
    uri: "mysql://user:password@localhost:3306/database",
  }),
});
```

MS SQL は Kysely の `MssqlDialect` を `tedious` + `tarn` で組んで渡す。

```ts
import { betterAuth } from "better-auth";
import { MssqlDialect } from "kysely";
import * as Tedious from "tedious";
import * as Tarn from "tarn";

const dialect = new MssqlDialect({
  tarn: { ...Tarn, options: { min: 0, max: 10 } },
  tedious: {
    ...Tedious,
    connectionFactory: () =>
      new Tedious.Connection({
        authentication: {
          options: { password: "password", userName: "username" },
          type: "default",
        },
        options: { database: "some_db", port: 1433, trustServerCertificate: true },
        server: "localhost",
      }),
  },
});

export const auth = betterAuth({ database: { dialect, type: "mssql" } });
```

### Drizzle（型安全・軽量・SQL 寄り）

型安全で軽量、生成される SQL が読みやすい。マイグレーションは drizzle-kit など**自前運用寄り**。`drizzleAdapter(db, ...)` に Drizzle インスタンスと `provider` を渡す。

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./database";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite", // "pg" / "mysql" も指定可
  }),
});
```

Drizzle アダプタは **スキーマのキー名がテーブル名と一致している前提**で動く。`user` テーブルを `users` という名で定義しているなら、明示的にマッピングする。

```ts
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      ...schema,
      user: schema.users,
    },
  }),
});
```

複数形で統一しているなら `usePlural: true` でまとめて寄せられる。

```ts
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    usePlural: true,
  }),
});
```

### Prisma（スキーマ駆動・広範な DB・ツール充実）

スキーマファースト。対応 DB が広く、Prisma Studio などツールが充実。クライアントは Drizzle より重め。`prismaAdapter(prisma, ...)` に `PrismaClient` と `provider` を渡す。

```ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "sqlite", // "postgresql" / "mysql" など
  }),
});
```

> Prisma 7 以降は `schema.prisma` の `output` パスが必須。カスタム出力先（例: `output = "../src/generated/prisma"`）を設定しているなら、`@prisma/client` ではなくそのパスから client を import すること。

### MongoDB（NoSQL ドキュメント）

唯一の非リレーショナル公式アダプタ。RDB 前提の機能（join 等）とは挙動が異なる点に注意。`MongoClient` から取り出した `db` を `mongodbAdapter(db)` に渡す。

```ts
import { betterAuth } from "better-auth";
import { MongoClient } from "mongodb";
import { mongodbAdapter } from "better-auth/adapters/mongodb";

const client = new MongoClient("mongodb://localhost:27017/database");
const db = client.db();

export const auth = betterAuth({
  database: mongodbAdapter(db),
});
```

> MongoDB はスキーマレスなので、後述の `migrate` / `generate` は不要（コレクションは自動で扱われる）。join はバージョン `1.4.0` 以降 `experimental.joins: true` でサポート。RDB を前提にしたプラグインの一部機能は挙動が異なりうるため、組み合わせは個別に確認する。

### コミュニティアダプタ

> Better Auth connects to a database through adapters. Beyond the official adapters we maintain, the community has built many more to support additional databases.

公式（Kysely 系・Drizzle・Prisma・MongoDB）以外にも、コミュニティ製アダプタで対応 DB を広げられる（分析系などコア外の DB を繋ぐケース）。標準アダプタで要件を満たせない場合の選択肢として community-adapters ドキュメントを参照する。

---

## 重要: modelName はテーブル名ではない

ハマりやすいので明示する。**`modelName` は「アダプタが認識するモデル名」であって、物理 DB のテーブル名ではない。**

- 組み込み Kysely や Drizzle / Prisma などのアダプタは、それぞれの世界の「モデル名」で `user` などを参照する。
- 物理テーブル名へのマッピングは ORM 側の責務（Prisma の `@@map`、Drizzle のテーブル定義名など）。

例えば Prisma で `model User { ... }` と定義していても、Better Auth から見たモデル名は **`modelName: "user"`**（小文字・単数のデフォルト）になる。「Prisma のモデルは `User` なのに、なぜ設定は `user` なのか」という混乱はここから生まれる。

コアスキーマのモデル名・カラム名を変えたい場合は `modelName` と `fields` で上書きする。

```ts
export const auth = betterAuth({
  user: {
    modelName: "users",
    fields: {
      name: "full_name",
      email: "email_address",
    },
  },
  session: {
    modelName: "user_sessions",
    fields: {
      userId: "user_id",
    },
  },
});
```

> ここで指定する `modelName` も「アダプタに対する論理名」。実テーブル名は最終的に ORM の設定が決める。

コアスキーマ（`user` / `session` / `account` / `verification`）の構造と `modelName` の前提は [§01 Concepts](01-concepts.html) で詳説している。

---

## CLI: migrate と generate

Better Auth には DB スキーマを扱う CLI が付属する。**どちらを使うかはアダプタで決まる。**

| コマンド | 対象 | 動作 |
|---|---|---|
| `npx auth migrate` | 組み込み Kysely アダプタのみ | スキーマを DB に直接適用 |
| `npx auth generate` | Prisma / Drizzle など ORM | ORM 用スキーマ / SQL ファイルを生成 |

- **`migrate`** は組み込み Kysely アダプタを使っているときだけ動く。DB に直接 DDL を流し込む。
- **`generate`** は Prisma / Drizzle を使っているとき。ORM のスキーマ（`schema.prisma` など）を生成するので、その後は **ORM 標準のマイグレーションツール**で適用する。組み込み Kysely の場合は手動実行用の SQL ファイルを出す。

```bash
# 組み込み Kysely アダプタ: そのまま DB へ適用
npx auth migrate

# Prisma / Drizzle: スキーマを生成 → 各 ORM のマイグレーションで適用
npx auth generate
```

> **プラグインを足すたびに再実行する。** プラグインは独自テーブル / カラムを定義するため、追加・有効化のたびに `migrate` または `generate` をかけ直さないとスキーマが追いつかない。

---

## 選び方早見表

要件（軸）から逆引きで候補を引く指針。第一候補に迷ったら一番下の行を見る。

| 要件 / 軸 | おすすめ | 理由 |
|---|---|---|
| サーバーレスで接続枯渇を避けたい | Neon / AWS RDS Data API | scale-to-zero・サーバーレスドライバ / HTTP 接続でプール不要 |
| エッジ（Workers 等）で動かす | Cloudflare D1 / Turso | ランタイム統合・エッジレプリカで低レイテンシ |
| git ライクな DB ブランチ（プレビュー環境） | Neon / PlanetScale | コピーオンライトの分岐 / ブランチ + deploy request |
| 大規模・水平スケールの MySQL | PlanetScale | Vitess による水平スケールと無停止スキーマ変更 |
| エンタープライズ / Windows 資産 | MS SQL | Microsoft エコシステムとの統合 |
| ローカル / 小規模 / 組込み | SQLite（better-sqlite3 / Bun SQLite） | サーバー不要・単一ファイルで完結 |
| 既に ORM を使っている | その ORM のアダプタ（Drizzle / Prisma） | 既存スキーマ・マイグレ運用に合わせる |
| ORM を入れたくない / 最軽量 | 組み込み Kysely（pg.Pool 等） | ドライバ一個で完結 |
| ドキュメント指向 / 既存 Mongo | MongoDB | 唯一の公式 NoSQL アダプタ |
| 認証イベントの分析・集計 | BigQuery / ClickHouse（主ストアとは別に） | OLAP は分析特化。認証本体は RDB に置く |
| とりあえず堅実な第一候補 | PostgreSQL | 実績・ドキュメント・拡張性が最も厚い |

---

## 一次情報

### Better Auth 公式

- Database（コンセプト全体・コアスキーマ・CLI・セカンダリストレージ）: <https://www.better-auth.com/docs/concepts/database>
- PostgreSQL アダプタ: <https://www.better-auth.com/docs/adapters/postgresql>
- MySQL アダプタ: <https://www.better-auth.com/docs/adapters/mysql>
- SQLite アダプタ: <https://www.better-auth.com/docs/adapters/sqlite>
- MS SQL アダプタ: <https://www.better-auth.com/docs/adapters/mssql>
- その他のリレーショナル DB: <https://www.better-auth.com/docs/adapters/other-relational-databases>
- Drizzle ORM アダプタ: <https://www.better-auth.com/docs/adapters/drizzle>
- Prisma アダプタ: <https://www.better-auth.com/docs/adapters/prisma>
- MongoDB アダプタ: <https://www.better-auth.com/docs/adapters/mongo>
- コミュニティアダプタ: <https://www.better-auth.com/docs/adapters/community-adapters>
- CLI（migrate / generate）: <https://www.better-auth.com/docs/concepts/cli>

### 各プロバイダ公式

- Kysely: <https://kysely.dev/>
- Supabase: <https://supabase.com/docs>
- Neon（ブランチング）: <https://neon.tech/docs/introduction/branching>
- Turso / libSQL: <https://docs.turso.tech/>
- PlanetScale（非ブロッキングスキーマ変更）: <https://planetscale.com/docs>
- Cloudflare D1: <https://developers.cloudflare.com/d1/>
- Prisma Postgres: <https://www.prisma.io/postgres>
- AWS RDS Data API: <https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/data-api.html>
