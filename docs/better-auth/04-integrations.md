# Integration — 対応フレームワーク網羅

> Better Auth は「特定フレームワークに縛られない」。コアが公開するのは Web 標準の `auth.handler: (req: Request) => Promise<Response>` ただ一つで、各フレームワーク統合はこのハンドラへ catch-all ルートを流し込む薄いアダプタにすぎない。だから **バックエンドが TypeScript なら大体いける**。

### 🎤 登壇メモ

- **つかみ**: 「Better Auth、対応フレームワークいくつあると思います？」と問いかけ → 答えは「数の問題じゃない。**ハンドラを 1 個挿すだけ**」だと種明かしする。
- **強調**: フレームワーク統合は“対応表”ではなく**薄いアダプタ**。本体は `auth.handler`（Web 標準 `Request` → `Response`）という 1 関数。ここだけは口で言い切る。
- **10分なら**: 一覧表 3 枚はスライドに出して「全部いけます」と流す（読み上げない）。手を止めるのはコード 3 例（Next.js / Hono / Expo）だけ。差し込み口の構文が違うだけで中身が同じ、を見せて終わり。

## 思想 — 「route handler を差し込むだけ」

Better Auth の本体は、サインイン・OAuth コールバック・セッション検証など全エンドポイントを 1 本の関数に集約している。

- コアの正体は `auth.handler(request: Request): Promise<Response>` という **Web Fetch API 標準**の関数。
- フレームワーク統合がやることは原則ひとつだけ — **`/api/auth/*` のような catch-all ルートを 1 個切って、そこに `auth.handler` を渡す**。
- だから Next.js だろうが Hono だろうが Express だろうが、差し込み口の書式が違うだけで中身は同じ。`Request` を渡して `Response` を返せる土台なら、Deno / Bun / Cloudflare Workers でも動く。
- 公式ヘルパ（`toNextJsHandler`, `toNodeHandler` など）は、各ランタイムの req/res 型と Web 標準型の橋渡しをするだけの糖衣。無くても `auth.handler` を直接呼べば成立する。

> つまり「Better Auth に対応しているか」ではなく「そのフレームワークが Web 標準の Request/Response を扱えるか」が本質。TS バックエンドのほとんどが YES。

`auth.handler` / API ハンドラがそもそも何を担うか（エンドポイント設計・ルーティングの基礎）は [§01 概念](01-concepts.html) を参照。

---

## カテゴリ別 対応一覧

### フロント / フルスタック

| フレームワーク | 区分 | 差し込み口（catch-all ルート） | ハンドラ |
|---|---|---|---|
| Next.js | 公式 (`better-auth/next-js`) | `app/api/auth/[...all]/route.ts` | `toNextJsHandler(auth)` |
| Nuxt | 公式 | `server/api/auth/[...all].ts` | `auth.handler(toWebRequest(event))` |
| SvelteKit | 公式 (`better-auth/svelte-kit`) | `src/hooks.server.ts` | `svelteKitHandler({ event, resolve, auth })` |
| SolidStart | 公式 (`better-auth/solid-start`) | `routes/api/auth/*all.ts` | `toSolidStartHandler(auth)` |
| Astro | 公式 | `pages/api/auth/[...all].ts` | `APIRoute` 内で `auth.handler(ctx.request)` |
| React Router v7 | 公式 | `app/routes/api.auth.$.ts`（resource route） | `loader` / `action` で `auth.handler(request)` |
| TanStack Start | 公式 | `src/routes/api/auth/$.ts`（API route） | `auth.handler(request)` |
| Remix | 公式 | `app/routes/api.auth.$.ts`（resource route） | `loader` / `action` で `auth.handler(request)` |

### バックエンド

| フレームワーク | 区分 | 差し込み口（catch-all ルート） | ハンドラ |
|---|---|---|---|
| Hono | 公式 | `app.on(["POST","GET"], "/api/auth/*", ...)` | `auth.handler(c.req.raw)` |
| Fastify | 公式 | `/api/auth/*` の catch-all ルート | Node req → Web `Request` 変換後に `auth.handler` |
| Express | 公式 (`better-auth/node`) | `app.all("/api/auth/*splat", ...)` | `toNodeHandler(auth)` |
| Elysia | 公式 | `/api/auth/*` を mount | `auth.handler` |
| Nitro | 公式 | `server/routes/api/auth/[...all].ts` | `auth.handler(toWebRequest(event))` |
| NestJS | コミュニティ (`@thallesp/nestjs-better-auth`) | AuthModule + catch-all | 内部で `auth.handler` |
| Encore | コミュニティ | raw endpoint の catch-all | `auth.handler(request)` |
| Convex | 公式コンポーネント (`@convex-dev/better-auth`) | Convex component 経由 | コンポーネントが内部で仲介 |

### モバイル / デスクトップ

| フレームワーク | 区分 | サーバ側 | クライアント側 |
|---|---|---|---|
| Expo | 公式 (`@better-auth/expo`) | `expo()` プラグイン + `trustedOrigins` | `expoClient({ scheme, storage })` |
| Lynx | 公式 | 既存サーバの `auth.handler` を流用 | `createAuthClient`（ByteDance Lynx 用） |
| Electron | コミュニティ | 既存サーバの `auth.handler` を流用 | renderer から `createAuthClient` |

> モバイル/デスクトップはサーバを新規に立てるのではなく、**既存の `auth.handler`（Next.js なり Hono なり）をそのまま叩く**のが基本。プラットフォーム差分は「クッキーをどこに保存するか」「どの scheme でディープリンクを受けるか」に集約される。

---

## 代表コード例

### 例 1: Next.js（フルスタック）

公式ヘルパ `toNextJsHandler` が `POST` / `GET` を生成する。App Router の catch-all セグメント `[...all]` に置くだけ。

```ts
// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth);
```

サーバコンポーネントや Server Action ではセッションを直接取得できる。

```ts
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const session = await auth.api.getSession({
  headers: await headers(),
});
```

`getSession` が返すセッション・サインイン/サインアップなど認証フロー本体の仕様は [§02 認証](02-authentication.html) を参照。

### 例 2: Hono（バックエンド）

catch-all ルートを 1 本切り、`c.req.raw`（Web 標準の `Request`）を `auth.handler` へ渡すだけ。

```ts
// server.ts
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { auth } from "./auth";

const app = new Hono();

app.on(["POST", "GET"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

serve(app);
```

> 別オリジンのクライアントから叩く場合、`cors` ミドルウェアは認証ルートより**前**に登録すること（プリフライトを認証エンドポイントに到達する前に処理させるため）。

### 例 3: Expo（モバイル）

モバイルは「サーバへ `expo()` プラグインを足す」「クライアントへ `expoClient()` を足す」の 2 ステップ。サーバの差し込み口は前述のフルスタック/バックエンド統合と同じものを流用する。

サーバ側 — プラグインと `trustedOrigins`（アプリの URL scheme）を追加:

```ts
// auth.ts
import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";

export const auth = betterAuth({
  plugins: [expo()],
  trustedOrigins: ["myapp://"],
});
```

クライアント側 — `expoClient` でセッション cookie を `SecureStore` に保存し、ディープリンク用 scheme を指定:

```ts
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

export const authClient = createAuthClient({
  baseURL: "http://localhost:8081",
  plugins: [
    expoClient({
      scheme: "myapp",
      storagePrefix: "myapp",
      storage: SecureStore,
    }),
  ],
});
```

---

## まとめ

- 3 例を見比べると、差し込み口の構文だけが違い、**渡しているのは常に `Request` → `auth.handler` → `Response`** という同一構造。
- フロント/フルスタックは「catch-all ルートに公式ヘルパ」、バックエンドは「ワイルドカードルートに `auth.handler`」、モバイル/デスクトップは「既存サーバ + クライアントプラグイン」。
- 新しいフレームワークが出ても、Web 標準の Request/Response を扱える限り統合は数行で済む — これが「縛られない」の実体。

### 関連章

- フレームワークを挿した後にどの DB へ書くか（同テーマの土台）→ [§05 Database](05-database.html)
- `auth.handler` / ルーティングの基礎概念 → [§01 概念](01-concepts.html)
- セッション・サインインなど認証フロー本体 → [§02 認証](02-authentication.html)

---

## 一次情報

- Better Auth — Integrations（一覧）: <https://www.better-auth.com/docs/integrations>
- [Next.js integration](https://www.better-auth.com/docs/integrations/next)
- [Hono integration](https://www.better-auth.com/docs/integrations/hono)
- [Expo integration](https://www.better-auth.com/docs/integrations/expo)
