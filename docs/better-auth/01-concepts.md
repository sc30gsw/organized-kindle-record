# コンセプト — コア構成要素

> Better Auth は「サーバーの `auth` インスタンス + クライアントの `authClient`」を中心に、API・CLI・Database アダプタ・Email・Plugins・OAuth・Cookies・Hooks・Session・Rate limit・User/Account・型推論という構成要素が噛み合って成り立つ。本章ではそれぞれを「何であるか／どう設定するか／どこにフックできるか」の観点で、コード例つきで詳細に解説する。

---

### 🎤 登壇メモ

- **つかみ**: 「Better Auth は “薄いコア＋プラグイン” の二層。この地図さえ掴めば、後の章は全部ここに刺さる」。
- **強調**: コアは常駐（session/cookie/user/account/rate limit）、機能はプラグインで足す——という**二層構造**が一番の勘所。
- **10分なら**: 構成要素の表をさっと見せ、**Session と Plugin の2つだけ**口頭で補足して先へ。各論は深入りしない。
- リンク先: 機能を足す仕組みは（→ [§03 プラグイン大全](03-plugins.html)）、ソーシャルログインは（→ [§02 認証](02-authentication.html)）、CLI/MCP は（→ [§07 AI Resources](07-ai-resources.html)）、DB アダプタは（→ [§05 Database](05-database.html)）。

---

すべての出発点は `betterAuth(options)` が返す **`auth` インスタンス**である。`auth` は以下を内包する。

- `auth.handler` — `/api/auth/*` を処理する Web 標準の `(req: Request) => Promise<Response>` ハンドラ。
- `auth.api` — 全エンドポイントをサーバー側から型安全に呼ぶための関数群。
- `auth.$Infer` — `Session` / `User` などの型を推論するための型専用名前空間。
- `auth.options` — 正規化済みの設定。

```ts
// auth.ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});
```

#### 全体像（コア＋プラグインの二層構造）

```text
Server: auth = betterAuth(options)
┌────────────────────────────────────────────────────────────
│ Plugins 層 (任意・着脱可)
│   twoFactor / organization / genericOAuth / passkey / ...
│   → endpoints・schema・hooks・rateLimit ルールを「足す」
├────────────────────────────────────────────────────────────
│ Core 層 (常に存在)
│   emailAndPassword・socialProviders・session・cookies
│   rateLimit・user / account・email
├────────────────────────────────────────────────────────────
│ Database アダプタ
│   Kysely(組込) / Prisma / Drizzle / MongoDB
└────────────────────────────────────────────────────────────
        │  auth.handler を /api/auth/* にマウント
        ▼
Client: createAuthClient(better-auth/react | vue | svelte | solid | client)
│   + 対のクライアントプラグイン (better-auth/client/plugins)
│   → authClient.signIn / signUp / useSession / twoFactor.* ...
└────────────────────────────────────────────────────────────
```

---

### API

Better Auth の機能はすべて **エンドポイント** として公開される。エンドポイントは 2 つの経路から呼べる。

1. **HTTP 経由**（クライアントやブラウザから）— `auth.handler` を `/api/auth/*` にマウントする。
2. **サーバー内部から直接** — `auth.api.*` を関数として呼ぶ。HTTP を経由しないため高速で、サーバーコンポーネントや Server Function、別の API ルートから利用する。

`auth.api` は「`auth` インスタンスに存在するすべてのエンドポイント」を関数として露出する。引数は `{ body, headers, query, params }` の形を取り、**戻り値は既定でパース済みのデータオブジェクト**（`Response` ではない）。

```ts
// サーバー側でセッションを取得する
import { auth } from "~/auth";
import { headers } from "next/headers";

const session = await auth.api.getSession({
  headers: await headers(), // 一部のendpointはheadersを要求する
});

// サインアップも内部呼び出しできる
const res = await auth.api.signUpEmail({
  body: { email: "test@example.com", password: "password1234", name: "Taro" },
});
```

#### Response / Headers の取得

データではなく生の `Response` が欲しい場合は `asResponse: true`、`Set-Cookie` などのレスポンスヘッダが欲しい場合は `returnHeaders: true` を渡す。

```ts
// 生のResponseが欲しい(handlerに転送したい)場合
const response = await auth.api.signInEmail({
  body: { email, password },
  asResponse: true,
});

// セッションCookieを自前のResponseに載せ替えたい場合
const { headers, response } = await auth.api.signInEmail({
  body: { email, password },
  returnHeaders: true,
});
const setCookie = headers.get("set-cookie");
```

#### route handler への接続

HTTP 経由で使う場合、各フレームワークのキャッチオールルートに `auth.handler` をマウントする。`basePath` の既定は `/api/auth`。

```ts
// Next.js App Router: app/api/auth/[...all]/route.ts
import { auth } from "~/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth.handler);
```

```ts
// Node/Express など: toNodeHandler を使う
import { auth } from "~/auth";
import { toNodeHandler } from "better-auth/node";

app.all("/api/auth/*", toNodeHandler(auth));
// 注意: Express では express.json() より前にマウントする(bodyを奪われないため)
```

> エラーハンドリング: `auth.api.*` は失敗時に `APIError` を throw する。HTTP 経由（`authClient`）では throw せず `{ data, error }` を返す、という非対称性に注意。

---

### CLI

`@better-auth/cli` はスキーマ生成・マイグレーション・初期化・診断を行う公式 CLI で、**プロジェクト初期から存在する**。設定ファイル（`auth.ts` など）を読み取り、登録済みプラグインも含めた必要スキーマを算出する。

| コマンド | 役割 |
|---|---|
| `generate` | アダプタに応じたスキーマ/マイグレーションファイルを生成する |
| `migrate` | スキーマを DB に直接適用する（**Kysely 組み込みアダプタ限定**） |
| `init` | プロジェクトに Better Auth を初期セットアップする |
| `secret` | `BETTER_AUTH_SECRET` 用のランダムキーを生成する |
| `info` | 環境・設定の診断情報を出力する（issue 報告用） |
| `mcp` | エディタ向けの MCP サーバー設定を書き出す |

```bash
# Prisma/Drizzle なら ORM スキーマ、Kysely なら SQL を生成
npx @better-auth/cli@latest generate

# Kysely 組み込みアダプタの場合のみ DB に直接適用できる
npx @better-auth/cli@latest migrate

# 初期化(npx auth@latest init でも可)
npx @better-auth/cli@latest init

# 秘密鍵の生成
npx @better-auth/cli@latest secret
```

#### MCP セットアップ

エディタの AI に Better Auth の文脈を渡すための MCP 設定を生成する。Cursor 向けは次のとおり。

```bash
npx @better-auth/cli mcp --cursor
```

> `generate` と `migrate` の違い: **Prisma / Drizzle / MongoDB など外部 ORM では `migrate` は使えない**。`generate` でスキーマを出力し、その ORM 自身のマイグレーションツール（`prisma migrate` など）で適用する。`migrate` が使えるのは内部 Kysely アダプタ（`pg` / `mysql2` / `better-sqlite3` 直結）のときだけ。

#### 主なオプション

- `--config` — 設定ファイルのパスを明示する（自動検出に失敗するとき）。
- `--output` — 生成物の出力先を指定する。
- `--yes` — 対話プロンプトをスキップする。

---

### Client

Better Auth はフロントエンド各種フレームワーク向けのクライアントライブラリを提供する。**インポートパスでフレームワークを切り替える**のがポイント。

| import パス | 対象 |
|---|---|
| `better-auth/react` | React（`useSession` は hook） |
| `better-auth/vue` | Vue（リアクティブな ref/store） |
| `better-auth/svelte` | Svelte（store） |
| `better-auth/solid` | Solid（signal） |
| `better-auth/client` | フレームワーク非依存（vanilla） |

```ts
// lib/auth-client.ts (React)
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "http://localhost:3000", // auth サーバーのベース URL
});
```

#### 主要なクライアントメソッド

```ts
// サインアップ(email/password)。email と password と name が必須
const { data, error } = await authClient.signUp.email({
  email: "user@email.com",
  password: "password",
  name: "User",
});

// サインイン(email/password)
await authClient.signIn.email({ email, password });

// ソーシャルサインイン(OAuth リダイレクト開始)
await authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" });

// サインアウト
await authClient.signOut();
```

クライアント呼び出しは throw せず、`{ data, error }` を返す。`error.code` で分岐し、`getErrorMessage()` などで翻訳できる。

#### セッションの参照

```tsx
// React: リアクティブに購読する hook
import { authClient } from "~/lib/auth-client";

export function UserButton() {
  const { data: session, isPending, error } = authClient.useSession();
  if (isPending) return <span>...</span>;
  return <span>{session?.user.name}</span>;
}
```

```ts
// 一度だけ取得する(非リアクティブ)
const { data: session } = await authClient.getSession();
```

#### セッションの失効（複数デバイス管理）

```ts
// アクティブなセッション一覧
const { data: sessions } = await authClient.listSessions();

// 特定のセッションを失効(token を指定)
await authClient.revokeSession({ token: sessions[0].token });

// 現在のセッション以外をすべて失効(ログイン中端末の一括ログアウト)
await authClient.revokeOtherSessions();

// すべてのセッションを失効
await authClient.revokeSessions();
```

> `useSession` がリアクティブストア、`getSession` が単発フェッチ。React の場合 `useSession` は hook、Vue/Svelte/Solid ではそのフレームワークのリアクティブ・プリミティブを返す。

---

### Database

Better Auth は **アダプタ経由** で DB に接続する。ユーザー・セッション・アカウント・検証トークンなどを保存する。

- **組み込み Kysely アダプタ** — `pg` / `mysql2` / `better-sqlite3` の接続インスタンス、または Kysely Dialect を `database` に渡すと、内部で Kysely を使って直接 SQL を発行する。`migrate` が使えるのはこのモードのみ。
- **ORM アダプタ** — `prismaAdapter` / `drizzleAdapter` / `mongodbAdapter` など。ORM 側のクライアントを渡し、スキーマは `generate` で出力する。

```ts
// 組み込み Kysely(pg を直接渡す)
import { betterAuth } from "better-auth";
import { Pool } from "pg";

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
});
```

```ts
// Prisma アダプタ
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
});
```

#### コアスキーマ

既定で `user` / `session` / `account` / `verification` の 4 モデルを使う。プラグインは独自モデルを追加する（例: `twoFactor` は `twoFactor` テーブル）。

#### `modelName` はテーブル名ではなく「アダプタのモデル名」

重要な落とし穴: `modelName` / `fields` で名前をカスタマイズできるが、**`modelName` はアダプタが解決する「モデル名」であってテーブル名そのものではない**。Prisma のような ORM では `modelName` は Prisma モデル名にマッピングされ、実テーブル名は ORM 側の `@@map` などが決める。Kysely 直結のときは実テーブル名と一致する。

```ts
export const auth = betterAuth({
  user: {
    modelName: "users", // アダプタのモデル名(ORM ではモデル名に解決)
    fields: {
      name: "full_name", // カラム名のリネーム
      email: "email_address",
    },
  },
  session: {
    modelName: "user_sessions",
    fields: { userId: "user_id" },
  },
});
```

---

### Email / Mail

Email は認証方式を問わず Better Auth の中核要素。メール送信ロジックは**ユーザーが実装する**（送信手段は任意の SMTP/SaaS）。Better Auth は「いつ・どんな URL/トークンで送るか」を組み立てて渡す。

#### メール検証（email verification）

```ts
export const auth = betterAuth({
  emailVerification: {
    sendOnSignUp: true,          // サインアップ時に検証メールを送る
    autoSignInAfterVerification: true, // 検証完了後に自動サインイン
    sendVerificationEmail: async ({ user, url, token }, request) => {
      await sendMail({
        to: user.email,
        subject: "メールアドレスの確認",
        body: `次のリンクで確認してください: ${url}`,
      });
    },
    afterEmailVerification: async (user, request) => {
      // 検証成功後の副作用(プレミアム付与など)
      console.log(`${user.email} verified`);
    },
  },
});
```

- `sendVerificationEmail({ user, url, token }, request)` — 検証メール送信の実体。`url` をそのまま踏ませれば検証が完了する。
- `sendOnSignUp: true` — サインアップ直後に検証メールを送る。
- `sendOnSignIn: true` — 未検証ユーザーが email/password でサインインを試みたときに送る（`sendVerificationEmail` 実装が前提）。
- `autoSignInAfterVerification: true` — 検証リンク踏破後に自動でセッションを張る。

#### パスワードリセット

リセットは `emailAndPassword` 側の `sendResetPassword` で送る。

```ts
export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    revokeSessionsOnPasswordReset: true, // リセット時に既存セッションを失効
    sendResetPassword: async ({ user, url, token }, request) => {
      await sendMail({
        to: user.email,
        subject: "パスワード再設定",
        body: `次のリンクから再設定してください: ${url}`,
      });
    },
  },
});
```

> 検証メールは `emailVerification.sendVerificationEmail`、リセットメールは `emailAndPassword.sendResetPassword` と**設定の置き場所が異なる**点に注意。

---

### Plugins

Plugins は Better Auth を拡張する中核機構。新しい認証方式・機能・振る舞いの上書きを差し込める。プラグインは **サーバー側プラグインとクライアント側プラグインのペア** で構成され、片方だけのものもある。

- サーバー側 — `betterAuth({ plugins: [...] })` に登録。エンドポイント・スキーマ・hooks・rate limit ルールなどを追加する。
- クライアント側 — `createAuthClient({ plugins: [...] })` に登録。対応するアクション・ストアを `authClient` に生やす。

**専用インポートパスでツリーシェイク**: サーバー側プラグインは `better-auth/plugins` から、クライアント側プラグインは `better-auth/client/plugins` から import する。サーバー／クライアントでエントリポイントが分かれており、各エントリもツリーシェイク可能なので、実際に使うプラグインのコードだけがバンドルに含まれる（一部プラグインは `better-auth/plugins/<name>` 形式の深いサブパスも公開する。例: `better-auth/plugins/mcp/client`）。

```ts
// auth.ts (サーバー)
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [twoFactor()],
});
```

```ts
// auth-client.ts (クライアント) — 対のプラグインを登録
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
});
// → authClient.twoFactor.* が型安全に生える
```

> サーバーにプラグインを足したら、対応するクライアントプラグインも登録する。これによりクライアント側のメソッドと型が自動的に揃う。

---

### OAuth

Better Auth は OAuth 2.0 / OpenID Connect を組み込みでサポートする。経路は 2 つ。

#### 1. socialProviders（組み込みプロバイダ）

Google・GitHub・Facebook など主要プロバイダは `socialProviders` に `clientId` / `clientSecret` を渡すだけで使える。

```ts
export const auth = betterAuth({
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      scope: ["openid", "email", "profile"],
      mapProfileToUser: (profile) => ({ name: profile.name }),
    },
  },
});
```

```ts
// クライアントからサインイン開始(プロバイダへリダイレクト)
await authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" });
```

#### 2. Generic OAuth（汎用プロバイダ）

組み込みにないプロバイダは `genericOAuth` プラグインで OIDC/OAuth2 エンドポイントを手動指定して接続する。

```ts
// auth.ts
import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "custom",
          clientId: process.env.CUSTOM_CLIENT_ID!,
          clientSecret: process.env.CUSTOM_CLIENT_SECRET!,
          discoveryUrl: "https://example.com/.well-known/openid-configuration",
          scopes: ["openid", "email"],
        },
      ],
    }),
  ],
});
```

```ts
// auth-client.ts
import { genericOAuthClient } from "better-auth/client/plugins";
// createAuthClient({ plugins: [genericOAuthClient()] })
// → authClient.signIn.oauth2({ providerId: "custom" })
```

> アカウント連携（同一ユーザーに複数プロバイダを紐付ける）の挙動は後述の **User + Account** の `accountLinking` で制御する。

---

### Cookies

Cookie はセッショントークン・セッションデータ・OAuth state などの格納に使われる。**すべての Cookie は `secret`（または `BETTER_AUTH_SECRET`）で署名される**。

#### セッション Cookie とキャッシュ戦略

セッション Cookie には毎リクエストで送られるトークンが入る。`session.cookieCache` を有効にすると、セッションデータを暗号化して Cookie 側にキャッシュし、毎回の DB アクセスを減らせる。`strategy` で表現方式を選ぶ。

| strategy | 内容 |
|---|---|
| `compact` | 既定。コンパクトな署名付き表現 |
| `jwt` | JWT 形式 |
| `jwe` | 暗号化された JWE 形式 |

```ts
export const auth = betterAuth({
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,      // 5分間キャッシュ
      strategy: "compact", // "jwt" / "jwe" も選べる
    },
  },
});
```

#### セキュア Cookie とドメイン共有

```ts
export const auth = betterAuth({
  advanced: {
    useSecureCookies: true, // Secure 属性を強制(本番では既定で有効)
    crossSubDomainCookies: {
      enabled: true,
      domain: "example.com", // app.example.com と auth.example.com で共有
    },
    cookiePrefix: "my-app", // Cookie 名のプレフィックスをカスタム
  },
});
```

- `useSecureCookies` — `Secure` 属性を付けて HTTPS 限定にする。本番では既定で有効。
- `crossSubDomainCookies` — サブドメイン間でセッション Cookie を共有する（`domain` 指定）。
- `cookiePrefix` / `advanced.cookies` — Cookie 名や個別属性（`sameSite` など）をカスタマイズする。

---

### Hooks

Hooks は「フルプラグインを書かずに振る舞いを差し込む」ための仕組み。**2 種類**ある。

#### 1. エンドポイント hooks（`hooks.before` / `hooks.after`）

リクエスト処理の前後に割り込む。`before` / `after` はそれぞれ **1 つの `createAuthMiddleware`** を受け取り、その中で `ctx.path` を条件分岐して複数エンドポイントを扱う。

```ts
import { betterAuth } from "better-auth";
import { createAuthMiddleware, APIError } from "better-auth/api";

export const auth = betterAuth({
  hooks: {
    // before: リクエストボディの書き換え・バリデーション・中断
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        if (!ctx.body?.email.endsWith("@example.com")) {
          throw new APIError("BAD_REQUEST", { message: "社内メールのみ許可" });
        }
        return { context: { ...ctx, body: { ...ctx.body, name: "Default" } } };
      }
    }),
    // after: レスポンス後の副作用。ctx.context.returned で結果を参照
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/sign-in")) {
        const session = ctx.context.returned; // 返却済みの値
        // 監査ログ送信などの background 処理
      }
    }),
  },
});
```

- `ctx.path` — エンドポイントのパス（`/sign-up/email` など）で分岐する。
- `ctx.body` / `ctx.headers` / `ctx.query` — 入力。`before` で書き換えると後段に伝播する。
- `ctx.context.returned` — `after` で参照できる「返却された値」。
- `ctx.context.session` — 現在のセッション。
- `throw new APIError(...)` — 任意の地点で処理を中断しエラーを返す。

#### 2. データベース hooks（`databaseHooks`）

`user` / `session` / `account` の各モデルに対し、DB レコードの `create` / `update` の `before` / `after` をフックする。

```ts
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";

export const auth = betterAuth({
  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          if (user.isAgreedToTerms === false) {
            throw new APIError("BAD_REQUEST", { message: "規約同意が必要です" });
          }
          return { data: { ...user, role: "user" } }; // payload を差し替え
        },
        after: async (user, ctx) => {
          // 作成後の副作用(ウェルカムメール等)
        },
      },
    },
  },
});
```

> `before` が `false` を返すと操作を中断、データオブジェクト（`{ data }`）を返すと元のペイロードを置き換える。`after` は作成/更新の成功後に呼ばれる。

---

### Session

Better Auth は**伝統的な Cookie ベースのセッション管理**を採る。セッションは Cookie に保存され、毎リクエストでサーバーへ送られる。

#### 有効期限と更新

- 既定で **7 日（`expiresIn`）** で失効する。
- セッションが使われ、かつ `updateAge`（既定 1 日）に達すると、失効時刻が「現在 + `expiresIn`」へ更新される（ローリング有効期限）。

```ts
export const auth = betterAuth({
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 日
    updateAge: 60 * 60 * 24,     // 1 日ごとに延長
  },
});
```

#### Secondary storage（Redis / KV）

セッションやレート制限カウンタを Redis などの KV に逃がす。`get` / `set` / `delete` の 3 関数を実装する。

```ts
export const auth = betterAuth({
  secondaryStorage: {
    get: async (key) => await redis.get(key),
    set: async (key, value, ttl) => await redis.set(key, value, "EX", ttl),
    delete: async (key) => await redis.del(key),
  },
});
```

- `session.storeSessionInDatabase` — secondary storage を使う場合でも、セッションを併せて主 DB にも保存するか。
- `cookieCache` — 前述のとおりセッションデータを Cookie にキャッシュし、毎回の読み出しを省く（実質ステートレス運用にもできる）。

```ts
// 主 DB を持たず Redis + 短命 Cookie キャッシュで運用する例
export const auth = betterAuth({
  secondaryStorage: { get: redisGet, set: redisSet, delete: redisDelete },
  session: {
    cookieCache: { maxAge: 5 * 60, refreshCache: false },
  },
});
```

#### セッション保存先の分岐

```text
セッションをどこに保存する?
│
├─ secondaryStorage を定義した?
│   ├─ Yes → セッションは secondaryStorage (Redis / KV) に保存
│   │         └─ storeSessionInDatabase: true なら 主DB にも併存させる
│   └─ No  → セッションは 主データベース (session テーブル) に保存
│
└─ session.cookieCache を有効化した?
    ├─ Yes → セッションデータを署名/暗号化して Cookie にキャッシュ
    │         (毎リクエストの保存先参照を省略 = ほぼ stateless)
    │         strategy: compact(既定) / jwt / jwe
    └─ No  → 毎回 保存先 (主DB or secondaryStorage) を参照
```

> ステートレス志向の構成では `cookieCache` を中心に据え、`secondaryStorage` で失効・revoke の整合を取る。完全ステートレスにすると即時 revoke が効きにくくなるトレードオフがある。

---

### Rate limit

Better Auth は組み込みのレートリミッタを持ち、**本番モードでは既定で有効**。

- 既定: **window 60 秒 / max 100 リクエスト**。
- ストレージは既定でメモリ。サーバーレスや複数インスタンスではメモリは不向きなので、DB か secondary storage に逃がす。

```ts
export const auth = betterAuth({
  rateLimit: {
    enabled: true,
    window: 60,  // 秒
    max: 100,    // window 内の最大リクエスト数
    storage: "secondary-storage", // "memory" | "database" | "secondary-storage"
    customRules: {
      "/sign-in/email": { window: 10, max: 3 }, // 厳しめの個別ルール
      "/two-factor/*": async (request) => ({ window: 10, max: 3 }),
    },
  },
});
```

- `storage` — `"memory"`（既定）/ `"database"` / `"secondary-storage"`。
- `customRules` — パス単位で `{ window, max }` を上書き。関数を渡して動的算出も可能。
- プラグインも独自ルールを定義する（例: `twoFactor` は `/two-factor/*` に専用のレート制限を持つ）。

> サーバーレス／水平スケール環境では `"memory"` だとインスタンスごとにカウンタが分裂する。`"database"` か `"secondary-storage"` を選ぶこと。

---

### User + Account

認証だけでなくユーザー/アカウント管理 API も提供する。**1 人の `user` に複数の `account`（= 認証方式・プロバイダ）が紐付く**モデル。email/password 登録には **`email` と `name` が必須**。

#### user の設定

```ts
export const auth = betterAuth({
  user: {
    modelName: "users",                    // アダプタのモデル名
    fields: { name: "full_name" },         // カラム名リネーム
    additionalFields: {                    // スキーマ拡張
      role: {
        type: ["user", "admin"],
        required: false,
        defaultValue: "user",
        input: false, // サインアップ時にユーザー入力を許可しない
      },
      lang: { type: "string", required: false, defaultValue: "en" },
    },
    changeEmail: {
      enabled: true, // 既定は無効。有効化してメール変更を許可
      sendChangeEmailVerification: async ({ user, newEmail, url, token }, request) => {
        await sendMail({ to: user.email, subject: "メール変更の確認", body: url });
      },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url, token }, request) => {
        await sendMail({ to: user.email, subject: "退会の確認", body: url });
      },
    },
  },
});
```

- `additionalFields` — `type` / `required` / `defaultValue` / `input` を持つフィールド定義でスキーマを拡張する。`input: false` は「登録時にクライアントから渡させない」フィールド（`role` 等）に使う。
- `changeEmail` — 既定で無効。`enabled: true` とし、検証メールを `sendChangeEmailVerification` で送る。
- `deleteUser` — 退会フロー。検証付きで `sendDeleteAccountVerification` を送り、`authClient.deleteUser({ token })` で確定する。

#### account の連携（accountLinking）

アカウント連携は**既定で有効**で、プロバイダが email を verified として返せば、既存ユーザーに別のソーシャル/OAuth を紐付けられる。

```ts
export const auth = betterAuth({
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"], // 自動連携を信頼するプロバイダ
      allowDifferentEmails: true,              // 異なる email でも連携を許可
    },
  },
});
```

> `trustedProviders` に含まれるプロバイダは email verified を信頼して自動連携する。`allowDifferentEmails: true` は「既存アカウントと別の email を返すプロバイダ」も連携対象にする（乗っ取りリスクとのトレードオフ）。

---

### 型安全（Type safety）

Better Auth はサーバー・クライアントとも TypeScript 製で、設定から型を推論する。`tsconfig.json` の `strict: true` を前提に最良の推論が効く。

#### サーバー側: `$Infer`

`auth.$Infer` から `Session`（`session` + `user`）などの型を取り出せる。`additionalFields` を足すと、その型にも自動で反映される。

```ts
import { auth } from "~/auth";

type Session = typeof auth.$Infer.Session;
// Session["user"]["role"] のような追加フィールドも型に乗る
```

#### クライアント側: サーバー型をブリッジする

クライアントに `additionalFields` を認識させるには、サーバーの `auth` 型を **`inferAdditionalFields<typeof auth>()` プラグイン** 経由で渡す。これが「サーバー型（`typeof auth`）をクライアントへ橋渡しする」正攻法。

```ts
// auth-client.ts
import { createAuthClient } from "better-auth/client";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "~/auth";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});
// → authClient.useSession() の user に role / lang などが型付きで現れる
```

> サーバーとクライアントが同一リポジトリなら `typeof auth` を直接渡せる。別リポジトリで `auth` 型を import できない場合は、`inferAdditionalFields({ user: { ... } })` のようにフィールド定義を手で渡す代替手段がある。プラグインのアクション/型も、クライアントに対応プラグインを登録することで自動的に推論される。

---

## 一次情報（参照元）

- API — <https://www.better-auth.com/docs/concepts/api>
- CLI — <https://www.better-auth.com/docs/concepts/cli>
- Client — <https://www.better-auth.com/docs/concepts/client>
- Database — <https://www.better-auth.com/docs/concepts/database>
- Email — <https://www.better-auth.com/docs/concepts/email>
- Plugins — <https://www.better-auth.com/docs/concepts/plugins>
- OAuth — <https://www.better-auth.com/docs/concepts/oauth>
- Cookies — <https://www.better-auth.com/docs/concepts/cookies>
- Hooks — <https://www.better-auth.com/docs/concepts/hooks>
- Session Management — <https://www.better-auth.com/docs/concepts/session-management>
- Rate Limit — <https://www.better-auth.com/docs/concepts/rate-limit>
- User & Accounts — <https://www.better-auth.com/docs/concepts/users-accounts>
- TypeScript — <https://www.better-auth.com/docs/concepts/typescript>
