# 認証 — Email & Password と OAuth

> Better Auth の中核となる 2 つの認証方式を解説する。前半は **Email & Password**（有効化・メール検証・パスワードリセット・パスワードポリシー・ハッシュ方式のカスタム）、後半は **OAuth / ソーシャルログイン**（`socialProviders` 設定、対応プロバイダ一覧、そして任意の OAuth2/OIDC に接続できる **Generic OAuth プラグイン**）を扱う。コード例は `auth.ts`（サーバー）と `auth-client.ts`（クライアント）の 2 ファイル構成を前提とする。

### 🎤 登壇メモ

- **つかみ**: 「ログイン機能、毎回ゼロから作っていませんか？」— Email & Password と Google / LINE ログインが、設定ファイル数行で立ち上がる体験を冒頭に見せる。
- **強調**: ① クライアント API が例外を投げず `{ data, error }` を返す設計、② メール列挙攻撃（user enumeration）対策がデフォルトで効く点、③ 組み込みに無いプロバイダでも Generic OAuth で「OAuth2 / OIDC なら何でも繋がる」拡張性。
- **10分なら**: Email & Password の有効化 → `signIn.social` で LINE ログイン → Generic OAuth の `signIn.oauth2` の 3 点に絞る。メール検証・ハッシュ方式カスタム・全オプション表はスキップし「詳細はリファレンス参照」と口頭で誘導する。

---

## Email & Password

メールアドレスとパスワードによる認証は最も一般的な方式であり、Better Auth は組み込みのオーセンティケータを提供する。データベースアダプタさえ設定されていれば、`emailAndPassword` を有効化するだけで使い始められる。

### 有効化

サーバー側 `auth.ts` の `betterAuth()` に `emailAndPassword: { enabled: true }` を渡す。これだけで `signUp.email` / `signIn.email` などのエンドポイントが有効になる。

```ts
// auth.ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
});
```

クライアントは `createAuthClient` で生成する。以降のサインアップ・サインインはこの `authClient` 経由で呼び出す。

```ts
// auth-client.ts
import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: "http://localhost:3000",
});
```

### サインアップ / サインインのコード例

サインアップは `authClient.signUp.email` を使う。`name` `email` `password` は必須で、`image` と `callbackURL` は任意。

```ts
const { data, error } = await authClient.signUp.email({
  name: "John Doe",
  email: "john.doe@example.com",
  password: "password1234",
  image: "https://example.com/image.png", // 任意
  callbackURL: "https://example.com/callback", // 任意（メール検証後のリダイレクト先）
});
```

サインインは `authClient.signIn.email`。`rememberMe` を `false` にすると、ブラウザを閉じた時点でセッションを失効させられる。

```ts
const { data, error } = await authClient.signIn.email({
  email: "john.doe@example.com",
  password: "password1234",
  rememberMe: true, // 任意（既定: true）
  callbackURL: "/dashboard", // 任意
});
```

> Better Auth のクライアント API は例外を投げず、`{ data, error }` のタプルを返す。`error` が `null` でなければ失敗として扱うこと。本プロジェクトの方針（`Result` ベース）とも親和性が高く、`error` を握りつぶさず分岐させる。

### 主な設定オプション

`emailAndPassword` に渡せる代表的なオプションは以下のとおり。

| オプション | 型 | 既定値 | 説明 |
|---|---|---|---|
| `enabled` | `boolean` | `false` | Email & Password 認証を有効化する。 |
| `disableSignUp` | `boolean` | `false` | サインアップのみを無効化する（招待制などで利用）。 |
| `minPasswordLength` | `number` | `8` | パスワードの最小文字数。 |
| `maxPasswordLength` | `number` | `128` | パスワードの最大文字数。 |
| `requireEmailVerification` | `boolean` | `false` | メール未検証ユーザーのサインインをブロックする。 |
| `autoSignIn` | `boolean` | `true` | サインアップ成功後に自動でサインインさせる。 |
| `sendResetPassword` | `function` | `undefined` | パスワードリセットメールを送信する関数。 |
| `onPasswordReset` | `function` | `undefined` | リセット成功後に実行されるコールバック。 |
| `resetPasswordTokenExpiresIn` | `number` | `3600` | リセットトークンの有効期間（秒）。既定は 1 時間。 |
| `revokeSessionsOnPasswordReset` | `boolean` | `false` | パスワードリセット時に全セッションを失効させる。 |
| `password` | `object` | — | `hash` / `verify` を差し替えてハッシュ方式をカスタムする。 |

### メール検証

メール検証は `emailVerification.sendVerificationEmail` で送信処理を実装し、`emailAndPassword.requireEmailVerification: true` で未検証ユーザーのサインインを禁止する。送信処理はメール送信ライブラリ（Resend / Nodemailer など）に委譲する。

```ts
// auth.ts
import { betterAuth } from "better-auth";
import { sendEmail } from "~/lib/email";

export const auth = betterAuth({
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }) => {
      void sendEmail({
        to: user.email,
        subject: "メールアドレスを確認してください",
        text: `次のリンクをクリックして確認を完了してください: ${url}`,
      });
    },
    sendOnSignUp: true, // サインアップ時に自動送信
    // sendOnSignIn: true, // 未検証ユーザーのサインイン試行時にも送信
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // 未検証ではサインイン不可
  },
});
```

クライアントから検証メールを再送する場合は `sendVerificationEmail` を呼ぶ。`callbackURL` は検証完了後のリダイレクト先。

```ts
await authClient.sendVerificationEmail({
  email: "user@email.com",
  callbackURL: "/", // 検証後のリダイレクト先
});
```

メール内リンクのトークンを使って明示的に検証する場合は `verifyEmail` を使う。

```ts
await authClient.verifyEmail({
  query: { token: "..." },
});
```

> **列挙攻撃（user enumeration）対策**: `requireEmailVerification` が有効、または `autoSignIn: false` のとき、サインアップエンドポイントは「メールが既に登録済みか否か」に関わらず同一の `200` を返す。これは [OWASP の認証ベストプラクティス](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#authentication-and-error-messages) に沿った挙動で、攻撃者が登録済みアドレスを推測できないようにするためのもの。既存ユーザーの再サインアップを検知したい場合は `onExistingUserSignUp` コールバックを使う。

### パスワードリセット

リセットは 3 ステップのフローになる。

1. **送信処理を実装**: サーバー側 `emailAndPassword.sendResetPassword` にリセットメール送信関数を渡す。引数は `{ user, url, token }` と `request`。
2. **リセット要求**: クライアントで `authClient.requestPasswordReset({ email, redirectTo })` を呼ぶ。ユーザーが存在すれば `sendResetPassword` が発火する。
3. **新パスワード設定**: メールのリンク先（`redirectTo` にトークン付きで遷移）で `authClient.resetPassword({ newPassword, token })` を呼ぶ。

サーバー設定。`onPasswordReset` でリセット完了後の監査ログなどを実行でき、`revokeSessionsOnPasswordReset` で既存セッションを一括失効させられる。

```ts
// auth.ts
export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    revokeSessionsOnPasswordReset: true, // リセット時に全セッション失効
    sendResetPassword: async ({ user, url, token }, request) => {
      void sendEmail({
        to: user.email,
        subject: "パスワードの再設定",
        text: `次のリンクからパスワードを再設定してください: ${url}`,
      });
    },
    onPasswordReset: async ({ user }, request) => {
      // リセット完了後の処理（監査ログ・通知など）
    },
  },
});
```

クライアント側。リセット要求と新パスワード設定。

```ts
// 1. リセットメールの送信を要求
const { data, error } = await authClient.requestPasswordReset({
  email: "john.doe@example.com",
  redirectTo: "https://example.com/reset-password", // 任意。リンク先 URL
});

// 2. リンク先ページでトークンと新パスワードを送信
const { data: reset, error: resetError } = await authClient.resetPassword({
  newPassword: "password1234",
  token, // URL のクエリパラメータから取得
});
```

> 旧バージョンでは `requestPasswordReset` が `forgetPassword` という名前だった。新規コードでは `requestPasswordReset` を使う。

### パスワードポリシー

最小・最大文字数は `minPasswordLength`（既定 8）と `maxPasswordLength`（既定 128）で設定する。

```ts
export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 256,
  },
});
```

文字種の必須化（記号・数字を含むなど）といった複雑なポリシーはコアには含まれない。サインアップの境界で Valibot などを使って入力検証するか、`before` フックでチェックを挟む。本プロジェクトでは境界バリデーションを Valibot で行う方針に合わせるとよい。

### ハッシュ方式のカスタム

Better Auth は既定で **scrypt** を使う。scrypt は計算コストとメモリコストが高くブルートフォースに強い方式で、OWASP が `argon2id` を使えない場合の推奨として挙げている（Node.js にネイティブ実装があるため Better Auth は scrypt を既定採用）。

要件に応じて `emailAndPassword.password.hash` と `password.verify` を差し替えれば、任意のアルゴリズム（例: Argon2id）に変更できる。以下は `@node-rs/argon2` を使う例。

```ts
// password.ts
import { hash, type Options, verify } from "@node-rs/argon2";

const opts: Options = {
  memoryCost: 65536, // 64 MiB
  timeCost: 3, // 3 回反復
  parallelism: 4, // 4 レーン
  outputLen: 32, // 32 バイト
  algorithm: 2, // Argon2id
};

export async function hashPassword(password: string) {
  const result = await hash(password, opts);
  return result;
}

export async function verifyPassword(data: { password: string; hash: string }) {
  const { password, hash } = data;
  const result = await verify(hash, password, opts);
  return result;
}
```

```ts
// auth.ts
import { hashPassword, verifyPassword } from "~/password";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
  },
});
```

> `verify` 関数は `{ password, hash }` を受け取り `boolean` を返す。引数の形が `hash` 関数と異なる点に注意。

---

## OAuth / ソーシャルログイン

Google や LINE などのソーシャルプロバイダは `socialProviders` に `clientId` / `clientSecret` を設定するだけで使える。Better Auth はコールバック URL（`/api/auth/callback/<provider>`）や ID トークン検証を内部で処理する。

> OAuth フロー全体や Cookie ベースのセッション管理といった前提概念は [§01 基礎概念](01-concepts.html) を参照。本章はプロバイダ設定とサインイン呼び出しに集中する。

### 設定例（Google / LINE）

```ts
// auth.ts
export const auth = betterAuth({
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      prompt: "select_account", // 任意。毎回アカウント選択を表示
      // scope: ["email", "profile"], // 任意。既定スコープに追加
    },
    line: {
      clientId: process.env.LINE_CLIENT_ID as string,
      clientSecret: process.env.LINE_CLIENT_SECRET as string,
      // redirectURI: "https://your.app/api/auth/callback/line", // 任意。カスタム redirect URI
      // scope: ["custom"], // 任意。スコープを追加
      // disableDefaultScope: true, // 既定スコープ [openid, profile, email] を置き換える
    },
  },
});
```

LINE を使うには **LINE Developers Console** での事前設定が必要。

1. LINE Developers Console でチャネルを作成する。
2. **Channel ID**（`client_id`）と **Channel secret**（`client_secret`）を控える。
3. チャネル設定に Redirect URI を追加する。ローカルなら `http://localhost:3000/api/auth/callback/line`。
4. 必要なスコープを有効化する（最低限 `openid`。名前・アバター・メールが必要なら `profile` `email` を追加）。

Google は [Google Cloud Console](https://console.cloud.google.com/apis/dashboard) の「認証情報」で OAuth クライアント ID を作成し、承認済みリダイレクト URI に `http://localhost:3000/api/auth/callback/google` を登録する。

クライアントからのサインインは `signIn.social` に `provider`（providerId）を渡す。

```ts
await authClient.signIn.social({
  provider: "line", // "google" / "line" など
  callbackURL: "/dashboard", // 任意。成功後のリダイレクト先
  errorCallbackURL: "/error", // 任意
  newUserCallbackURL: "/welcome", // 任意。新規ユーザーのみ
});
```

> **ID トークンによるサインイン**: Google・Apple・Microsoft Entra・Facebook・Cognito のように `aud`（audience）でトークンを検証するプロバイダでは、`clientId` に配列を渡して複数のクライアント ID を受け入れられる。Web / iOS / Android で別々のクライアント ID を持つネイティブ SDK のトークンを、単一のバックエンド設定でクロスプラットフォームに受理できる。

### 対応プロバイダ一覧

Better Auth は組み込みで多数のソーシャルプロバイダをサポートする（`socialProviders.<id>` で設定）。カテゴリ別の代表例は以下のとおり。

| カテゴリ | プロバイダ（providerId） |
|---|---|
| 主要 ID 基盤 | Google (`google`), Apple (`apple`), Microsoft (`microsoft`), Facebook (`facebook`) |
| 日本・アジア向け | **LINE (`line`)**, **Kakao (`kakao`)**, **Naver (`naver`)**, VK (`vk`) |
| 開発者 / コード | GitHub (`github`), GitLab (`gitlab`), Hugging Face (`huggingface`) |
| チャット / コミュニティ | Discord (`discord`), Slack (`slack`), Twitch (`twitch`), Reddit (`reddit`), Kick (`kick`) |
| 生産性 / SaaS | Notion (`notion`), Atlassian (`atlassian`), Linear (`linear`), Figma (`figma`), Dropbox (`dropbox`), Salesforce (`salesforce`), Vercel (`vercel`), Zoom (`zoom`), LinkedIn (`linkedin`) |
| メディア / ソーシャル | Twitter/X (`twitter`), TikTok (`tiktok`), Spotify (`spotify`), Roblox (`roblox`) |
| クラウド ID | Amazon Cognito (`cognito`) |

> **日本向けの実務メモ**: 国内サービスでは **LINE** が事実上の標準ログインになりやすい。韓国市場を視野に入れるなら **Kakao** と **Naver** が必須級。いずれも組み込みプロバイダとして提供されるため、`clientId` / `clientSecret` の設定だけで導入できる。後述の Generic OAuth が必要なプロバイダと異なり、これらはプロフィールマッピングまで Better Auth が面倒を見てくれる。

---

## Generic OAuth プラグイン

組み込みプロバイダに無いサービスでも、**OAuth 2.0 または OpenID Connect (OIDC) に準拠していれば** `genericOAuth` プラグインで接続できる。社内 IdP、Auth0 / Keycloak / Okta などの ID 基盤、あるいは Instagram・Coinbase のような独自 OAuth もこれで扱う。

> プラグイン機構そのもの（登録方法・ライフサイクル・他プラグインとの組み合わせ）の詳細は [§03 プラグイン](03-plugins.html) を参照。本節は Generic OAuth の設定とサインインに絞る。

### セットアップ（サーバー + クライアント）

サーバー側は `genericOAuth` を `plugins` に追加し、`config` 配列に各プロバイダを定義する。

```ts
// auth.ts
import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "custom-oauth",
          clientId: process.env.CUSTOM_CLIENT_ID as string,
          clientSecret: process.env.CUSTOM_CLIENT_SECRET as string,
          authorizationUrl: "https://auth.example.com/authorize",
          tokenUrl: "https://auth.example.com/token",
          issuer: "https://auth.example.com", // 期待する issuer を明示
          scopes: ["openid", "profile", "email"],
        },
      ],
    }),
  ],
});
```

クライアント側は `genericOAuthClient` を `plugins` に追加する。

```ts
// auth-client.ts
import { createAuthClient } from "better-auth/client";
import { genericOAuthClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [genericOAuthClient()],
});
```

サインインは `signIn.oauth2` に `providerId` を渡す。組み込み用の `provider` ではなく `providerId` を使う点に注意。

```ts
const { data, error } = await authClient.signIn.oauth2({
  providerId: "custom-oauth",
  callbackURL: "/dashboard", // 任意
  errorCallbackURL: "/error-page", // 任意
  newUserCallbackURL: "/welcome", // 任意
  // disableRedirect, // 任意
  // scopes, // 任意
  // requestSignUp, // 任意
});
```

### プリセットヘルパー

主要な ID 基盤にはプリセットヘルパー関数が用意されており、エンドポイント URL を手書きせずに `clientId` / `clientSecret` だけで設定できる。

- **Auth0** — `auth0(options)`
- **Keycloak** — `keycloak(options)`
- **Okta** — `okta(options)`
- **Microsoft Entra ID (Azure AD)** — `microsoftEntraId(options)`
- **Slack** — `slack(options)`
- **HubSpot** — `hubspot(options)`
- **LINE** — `line(options)`
- **Patreon** — `patreon(options)`

ヘルパーを使った例（Slack）。`config` 配列の要素としてヘルパーの戻り値を渡す。

```ts
// auth.ts
import { genericOAuth, slack } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    genericOAuth({
      config: [
        slack({
          clientId: process.env.SLACK_CLIENT_ID as string,
          clientSecret: process.env.SLACK_CLIENT_SECRET as string,
        }),
      ],
    }),
  ],
});
```

クライアントのサインインは providerId をヘルパー名に合わせる。

```ts
// sign-in.ts
const response = await authClient.signIn.oauth2({
  providerId: "slack",
  callbackURL: "/dashboard",
});
```

### 手動設定（Instagram / Coinbase）

ヘルパーが無いプロバイダは、エンドポイント URL とスコープを直接指定する。

Instagram の例。

```ts
export const auth = betterAuth({
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "instagram",
          clientId: process.env.INSTAGRAM_CLIENT_ID as string,
          clientSecret: process.env.INSTAGRAM_CLIENT_SECRET as string,
          authorizationUrl: "https://api.instagram.com/oauth/authorize",
          tokenUrl: "https://api.instagram.com/oauth/access_token",
          scopes: ["user_profile", "user_media"],
        },
      ],
    }),
  ],
});
```

Coinbase の例。

```ts
export const auth = betterAuth({
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "coinbase",
          clientId: process.env.COINBASE_CLIENT_ID as string,
          clientSecret: process.env.COINBASE_CLIENT_SECRET as string,
          authorizationUrl: "https://www.coinbase.com/oauth/authorize",
          tokenUrl: "https://api.coinbase.com/oauth/token",
          scopes: ["wallet:user:read"], // 必要に応じて追加
        },
      ],
    }),
  ],
});
```

### OIDC を discoveryUrl で自動設定

OpenID Connect 準拠のプロバイダなら、`discoveryUrl`（`.well-known/openid-configuration`）を渡すだけで `authorizationUrl` / `tokenUrl` / `userInfoUrl` などを自動取得できる。`issuer` も discovery ドキュメントから補完される。

```ts
genericOAuth({
  config: [
    {
      providerId: "my-provider",
      discoveryUrl: "https://auth.example.com/.well-known/openid-configuration",
      clientId: "...",
      clientSecret: "...",
      // issuer は discovery ドキュメントから自動取得される
    },
  ],
});
```

### 設定オプション（GenericOAuthConfig）

`config` 配列の各要素が取れる主なフィールドは以下のとおり。

| フィールド | 型 | 説明 |
|---|---|---|
| `providerId` | `string` | プロバイダ識別子（必須）。`signIn.oauth2` の `providerId` と一致させる。 |
| `clientId` | `string` | OAuth クライアント ID（必須）。 |
| `clientSecret` | `string` | OAuth クライアントシークレット（必須）。 |
| `discoveryUrl` | `string` | OIDC/OAuth 設定の自動取得 URL。指定すると各エンドポイントを補完。 |
| `issuer` | `string` | 期待する issuer。discoveryUrl 未使用時に手動指定。 |
| `requireIssuerValidation` | `boolean` | issuer の厳密検証を要求するか。 |
| `authorizationUrl` | `string` | 認可エンドポイント。discoveryUrl 未使用時に必要。 |
| `tokenUrl` | `string` | トークンエンドポイント。discoveryUrl 未使用時に必要。 |
| `userInfoUrl` | `string` | ユーザー情報エンドポイント。 |
| `scopes` | `string[]` | 要求するスコープ。 |
| `redirectURI` | `string` | カスタムリダイレクト URI。 |
| `responseType` | `string` | OAuth レスポンスタイプ。既定は認可コードフローの `"code"`。 |
| `prompt` | `string` | 認可画面の挙動（例: `select_account`）。 |
| `pkce` | `boolean` | PKCE を有効化するか。 |
| `accessType` | `string` | アクセスタイプ（Google の `offline` など）。 |
| `accessTokenExpiresIn` | `number` | アクセストークンの有効期間（秒）。 |
| `getUserInfo` | `function` | トークンからユーザー情報を取得する独自関数。 |

---

## 一次情報（出典）

- Email & Password: <https://www.better-auth.com/docs/authentication/email-password>
- Google: <https://www.better-auth.com/docs/authentication/google>
- LINE: <https://www.better-auth.com/docs/authentication/line>
- Other Social Providers: <https://www.better-auth.com/docs/authentication/other-social-providers>
- Generic OAuth プラグイン: <https://www.better-auth.com/docs/plugins/generic-oauth>
