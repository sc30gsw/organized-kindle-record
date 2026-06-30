# プラグイン大全

> Better Auth は「コアは最小・機能はプラグインで足す」設計。本章は公式プラグインをグループ別に表で俯瞰し、主要なものは `auth.ts` / `auth-client.ts` の設定コード例まで示す網羅リファレンス。決済・エンタープライズ・AI エージェント向けまで含む。

---

### 🎤 登壇メモ

- **つかみ**: 「Better Auth は本体が薄い。認証の“付加機能”は全部プラグイン。`plugins: []` に足すだけで 2FA も組織管理も決済も生える」。コア最小・プラグインで盛る思想を最初に共有する。
- **強調**: ① 専用パス import（`better-auth/plugins` / `better-auth/client/plugins`）でツリーシェイク、② **追加のたび CLI generate/migrate**（忘れるとスキーマ不整合で落ちる）、③ サーバとクライアントは必ずペアで足す。
- **10分なら**: 全部は紹介しない。代表数個に絞る — 2FA・Passkey（認証の今）、Organization（マルチテナント RBAC）、Agent Auth（AI 時代の目玉）、Stripe/Polar（決済は「MoR か直接 PSP か」だけ触れる）。残りは「グループ表で俯瞰できる」と早見表・選び方表に逃がす。

---

### 共通の注意（全プラグイン必読）

導入手順はどのプラグインも基本的に同じ。「**サーバ側**（`betterAuth({ plugins: [...] })`）に追加」→「**クライアント側**（`createAuthClient({ plugins: [...] })`）に対応プラグインを追加」→「**スキーマ再生成・マイグレーション**」の 3 ステップ。

> **専用パスから import する（ツリーシェイク）**。バレル import ではなく機能ごとの専用パスから読み込むことで、使わないプラグインのコードがバンドルに混入しない。

- サーバ側の多くは `better-auth/plugins`、クライアント側は `better-auth/client/plugins` から import する。
- ここで言う「専用パス」は `better-auth/plugins` / `better-auth/client/plugins` という名前付き export の入口のこと。`better-auth/plugins/two-factor` のようなプラグイン個別サブパスは**存在しない**（アクセス制御ヘルパーの `better-auth/plugins/access` だけは例外的サブパス）。
- 一部は**独立パッケージ**で、別経路から import する（下表）。

| プラグイン | サーバ import | クライアント import |
|---|---|---|
| 標準（2FA, username, organization, admin, apiKey, jwt, bearer 等） | `better-auth/plugins` | `better-auth/client/plugins` |
| Passkey | `@better-auth/passkey` | `@better-auth/passkey/client` |
| Stripe | `@better-auth/stripe` | `@better-auth/stripe/client` |
| SSO | `@better-auth/sso` | `@better-auth/sso/client` |
| Polar | `@polar-sh/better-auth` | （Polar SDK 経由） |
| Dub | `@dub/better-auth` | `@dub/better-auth` |

> **プラグインを追加・変更するたびに CLI で generate / migrate を再実行する**。プラグインは独自テーブルやカラム（2FA のシークレット、passkey の公開鍵、organization のメンバー表など）を要求するため、これを忘れると実行時にスキーマ不整合で落ちる。

```bash
# スキーマ定義を再生成（Drizzle/Prisma などのアダプタに反映）
npx @better-auth/cli generate

# 実 DB にマイグレーション適用（Kysely/組み込みアダプタ利用時）
npx @better-auth/cli migrate
```

---

### 認証系

ログイン手段・本人確認手段を増やすプラグイン群。`emailAndPassword` や `socialProviders` といったコア機能に対し、これらを足して認証 UX を組み立てる。

| プラグイン | 役割 | 主な設定・API | 備考 |
|---|---|---|---|
| **Two-Factor (2FA)** | 二要素認証。TOTP・OTP・バックアップコード・信頼済みデバイス | `twoFactor()` / `twoFactorClient()` | ログイン後に第二要素検証フローを挿入 |
| **Username** | メールに加えユーザー名でログイン | `username({ minUsernameLength })` | email+password の軽量拡張 |
| **Anonymous** | PII なしで認証済み体験。後から本アカウントへリンク | `anonymous({ onLinkAccount, emailDomainName })` | ゲスト→本登録の移行に最適 |
| **Phone Number** | 電話番号 + SMS OTP でサインイン/アップ | `phoneNumber({ sendOTP, signUpOnVerification })` | SMS 送信は自前実装 |
| **Magic Link** | パスワードレス。メールのリンクをクリックで認証 | `magicLink({ sendMagicLink })` / `signIn.magicLink()` | リンク送信は自前実装 |
| **Email OTP** | メールに届く OTP でサインイン/検証/パスワードリセット | `emailOTP({ sendVerificationOTP, otpLength, expiresIn })` | `type` で用途切替 |
| **Passkey** | WebAuthn/FIDO2 のパスキー。生体・PIN・セキュリティキー | `passkey({ rpID, rpName, origin })` | フィッシング耐性。独立パッケージ |
| **Generic OAuth** | 任意の OAuth2 / OIDC プロバイダを追加 | `genericOAuth({ config: [...] })` | コア未対応プロバイダ用の汎用口 |
| **One Tap** | Google One Tap のワンタップログイン | `oneTap()` / `oneTapClient({ clientId })` | Google アカウント前提 |
| **SIWE** | Sign-In with Ethereum（ERC-4361）。ウォレット署名で認証 | `siwe({ domain, getNonce, verifyMessage, ensLookup })` | nonce/署名検証は自前実装 |

#### Two-Factor (2FA)

TOTP（認証アプリ）、メール/SMS の OTP、バックアップコード、信頼済みデバイスをまとめて提供。クライアントでは第二要素が必要なときのリダイレクト先を制御する。

```ts
// auth.ts
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    twoFactor({
      issuer: "MyApp", // 認証アプリ上の表示名
      otpOptions: {
        async sendOTP({ user, otp }) {
          // メール/SMS で otp を送信
        },
      },
    }),
  ],
});
```

```ts
// auth-client.ts
import { createAuthClient } from "better-auth/client";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        // 第二要素検証ページへプログラム的に遷移（フルリロード回避）
      },
    }),
  ],
});
```

#### Email OTP

メールに届くワンタイムコードで、サインイン・メール検証・パスワードリセットを 1 つの仕組みで賄う。`type` で用途を切り替える。

```ts
// auth.ts
import { emailOTP } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300, // 秒
      async sendVerificationOTP({ email, otp, type }) {
        // type は "sign-in" | "email-verification" | "forget-password"
        // email 宛に otp を送信
      },
    }),
  ],
});
```

```ts
// クライアントから OTP 送信
await authClient.emailOtp.sendVerificationOtp({
  email: "user@example.com",
  type: "sign-in",
});
```

#### Passkey

WebAuthn/FIDO2 ベースのパスワードレス認証。`rpID`（リライング・パーティ ID）は認証サーバのオリジン由来で、ローカル開発では `localhost` でよい。独立パッケージ `@better-auth/passkey` から import する。

```ts
// auth.ts
import { betterAuth } from "better-auth";
import { passkey } from "@better-auth/passkey";

export const auth = betterAuth({
  plugins: [
    passkey({
      rpID: "example.com",
      rpName: "My App",
      origin: "https://example.com",
    }),
  ],
});
```

```ts
// クライアントでパスキー登録
await authClient.passkey.addPasskey({ name: "Primary passkey" });
```

#### Generic OAuth

コアの `socialProviders` に無いプロバイダを、エンドポイント URL を直接指定して追加する汎用プラグイン。OAuth 2.0 と OIDC の両方に対応。

```ts
// auth.ts
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
          issuer: "https://auth.example.com", // OIDC の期待 issuer
          scopes: ["openid", "profile", "email"],
        },
      ],
    }),
  ],
});
```

#### SIWE（Sign-In with Ethereum）

Ethereum ウォレット署名で認証する ERC-4361 準拠プラグイン。nonce 生成と署名検証は自前実装（`viem` 推奨）。`verifyMessage` は署名復元のみを返せばよく、nonce・ドメイン・Chain ID・有効期限の検証はプラグインが行う。

```ts
// auth.ts
import { siwe } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    siwe({
      domain: "myapp.com",
      anonymous: false, // false ならメール紐付けユーザーを作成
      getNonce: async () => generateSecureNonce(),
      verifyMessage: async ({ message, signature, address }) => {
        // viem の verifyMessage 等で署名を検証し boolean を返す
        return await verifySignature({ message, signature, address });
      },
    }),
  ],
});
```

---

### 認可・承認系

「誰が・何を・どこまでできるか」を制御するプラグイン群。管理機能、API 認証、組織/RBAC、AI エージェント認可など。

| プラグイン | 役割 | 主な設定・API | 備考 |
|---|---|---|---|
| **Admin** | ユーザー管理・ロール付与・BAN・なりすまし（impersonate） | `admin({ adminRoles, adminUserIds, impersonationSessionDuration })` | 管理ダッシュボードの土台 |
| **Agent Auth** | AI エージェント固有 identity・登録・ディスカバリ・能力ベース認可 | `agentAuth({ capabilities, onExecute })` | 標準策定中で API は流動的 |
| **API Key** | API キーの発行・管理・検証。レート制限・有効期限・メタデータ | `apiKey()` / `auth.api.verifyApiKey()` | サーバ間/プログラム認証向け |
| **MCP** | 自アプリを MCP クライアント向け OAuth プロバイダ化 | `mcp({ loginPage, oidcConfig })` / `withMcpAuth` | OAuth Provider へ移行予定 |
| **Organization** | 組織・メンバー・招待・チーム・RBAC・動的アクセス制御 | `organization({ ac, teams, dynamicAccessControl })` | マルチテナント SaaS の中核 |

#### Admin

ユーザーの作成・一覧・ロール変更・BAN/解除に加え、**impersonate（なりすまし）**で対象ユーザーのセッションを再現できる（既定 1 時間、`impersonationSessionDuration` で変更）。`adminRoles` か `adminUserIds` で管理者を指定。

```ts
// auth.ts
import { admin } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    admin({
      adminRoles: ["admin", "superadmin"],
      adminUserIds: ["user_id_1"], // ここに含まれるユーザーは全管理操作が可能
      impersonationSessionDuration: 60 * 60, // 秒（既定 1 時間）
      defaultBanReason: "規約違反",
    }),
  ],
});
```

```ts
// クライアントでなりすまし・BAN
await authClient.admin.impersonateUser({ userId: "user-id" });
await authClient.admin.banUser({ userId: "user-id", banReason: "spam" });
```

#### Agent Auth

AI エージェントに**固有の identity** を与え、**登録（registration）・ディスカバリ・能力（capability）ベースの認可**を行うプラグイン。エージェントはディスカバリで得た実行 URL（既定 `default_location`）を叩き、プラグインが `onExecute` を実行する。capability に `location` を指定すると既存 REST ルートへ向け、その場合 `onExecute` は使わず自前ハンドラで解決する。

> このプラグインは策定中の標準の実装で、まだ安定版ではなく API が変わりうる（`better-auth` 公式 org の実験的プラグイン）。本番採用は慎重に。

AI エージェント向けの全体像・関連リソースは [§07 AI リソース](07-ai-resources.html) を参照。

```ts
// auth.ts（イメージ）
import { agentAuth } from "@better-auth/agent-auth";

export const auth = betterAuth({
  plugins: [
    agentAuth({
      capabilities: {
        // エージェントに許可する能力を宣言
      },
      onExecute: async (ctx) => {
        // default_location 経由の実行を処理
      },
    }),
  ],
});
```

#### API Key

API キーの発行・管理・検証を提供。**ビルトインのレート制限**、カスタム有効期限、残回数制限、メタデータ、パーミッションに対応。サーバ間連携やプログラムアクセスの認証に使う。

```ts
// auth.ts
import { apiKey } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    apiKey({
      rateLimit: { enabled: true, maxRequests: 100 },
      enableMetadata: true,
    }),
  ],
});
```

```ts
// キー検証（権限チェック付き）
const { valid } = await auth.api.verifyApiKey({
  body: { key: "the_api_key", permissions: { files: ["read"] } },
});
```

#### MCP

自アプリを **MCP（Model Context Protocol）クライアント向けの OAuth プロバイダ**にする。アクセストークンの発行・管理を担い、`withMcpAuth` で MCP サーバを保護する。MCP サーバが別プロセス/別言語なら、Bearer トークンをリモート検証する軽量な **MCP Client** も使える。

> 本プラグインは近く **OAuth Provider プラグイン**へ統合・置き換え予定（スキーマは OIDC Provider と共通）。新規実装では移行先も意識する。

```ts
// auth.ts
import { mcp } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    mcp({
      loginPage: "/sign-in", // 未認証クライアントのログイン誘導先
    }),
  ],
});
```

#### Organization

組織・メンバー・**招待**・**チーム**・**RBAC**を提供するマルチテナントの中核。`ac`（アクセスコントローラ）と `dynamicAccessControl` を有効化すると、実行時に組織ごとのカスタムロールを生成できる。サーバ・クライアント双方に `teams` を渡してチーム機能を有効化する。

```ts
// auth.ts
import { organization } from "better-auth/plugins";
import { ac } from "@/auth/permissions";

export const auth = betterAuth({
  plugins: [
    organization({
      ac, // 動的アクセス制御に必須
      teams: { enabled: true },
      dynamicAccessControl: {
        enabled: true,
        maximumRolesPerOrganization: 10,
      },
    }),
  ],
});
```

```ts
// auth-client.ts
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [organizationClient({ teams: { enabled: true } })],
});
```

---

### 企業（エンタープライズ）

自社を ID プロバイダ化したり、企業顧客の SSO / プロビジョニング要件に応える層。OIDC Provider と MCP は将来 **OAuth Provider** へ統合される。

| プラグイン | 役割 | 主な設定・API | 備考 |
|---|---|---|---|
| **OIDC Provider** | 自前の OpenID Connect プロバイダを構築 | `oidcProvider({ loginPage, consentPage })` | OAuth Provider へ移行予定 |
| **OAuth Provider** | OIDC Provider と MCP を束ねる後継プラグイン | （統合 API） | 上記 2 つの移行先 |
| **SSO** | SAML 2.0 / OIDC / OAuth2 プロバイダを「消費」して SSO ログイン | `sso({ organizationProvisioning })` / `registerSSOProvider` | 顧客の自己設定 SSO はエンタープライズ |
| **SCIM** | クロスドメイン ID プロビジョニング（SCIM サーバを公開） | `scim()` / `auth.api.getSCIMResourceType()` | ディレクトリ同期・自動ユーザー管理 |

#### OIDC Provider

自社を **OIDC プロバイダ**にして、サードパーティアプリにログインを提供する。ログイン/同意画面を差し替えたり、`getAdditionalUserInfoClaim` で UserInfo に独自クレームを足せる。

```ts
// auth.ts
import { oidcProvider } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    oidcProvider({
      loginPage: "/sign-in",
      consentPage: "/oauth/consent",
      getAdditionalUserInfoClaim: async (user, scopes, client) => {
        return { role: user.role };
      },
    }),
  ],
});
```

> OIDC Provider と MCP はともに **OAuth Provider プラグイン**へ統合される予定。両者はスキーマを共有しており、将来的には OAuth Provider が単一の窓口になる。

#### SSO

外部の **SAML 2.0 / OIDC / OAuth2 プロバイダを消費**して、ユーザーが 1 組の資格情報で複数アプリにログインできるようにする。独立パッケージ `@better-auth/sso`。組織プロビジョニングと組み合わせると、ドメイン→組織のマッピングやロール自動付与ができる。

```ts
// auth.ts
import { betterAuth } from "better-auth";
import { sso } from "@better-auth/sso";

export const auth = betterAuth({
  plugins: [
    sso({
      organizationProvisioning: {
        disabled: false,
        defaultRole: "member",
      },
    }),
  ],
});
```

```ts
// プロバイダを登録（SAML 例）
await auth.api.registerSSOProvider({
  body: {
    providerId: "acme-corp",
    issuer: "https://acme.okta.com",
    domain: "acmecorp.com",
    organizationId: "org_acme_id",
    samlConfig: {
      /* メタデータ・証明書など */
    },
  },
  headers,
});
```

#### SCIM

**SCIM サーバ**を公開し、外部 IdP（Okta・Entra ID 等）からのユーザー/グループの自動プロビジョニング（作成・更新・無効化）を受け付ける。属性は既定でコアフィールドへ自動マッピングされ、カスタマイズも可能。エンタープライズのディレクトリ同期要件で使う。

---

### ユーティリティ

トークン発行、ボット対策、API ドキュメント、セッション運用などの補助プラグイン群。

| プラグイン | 役割 | 主な設定 | 備考 |
|---|---|---|---|
| **Bearer Token** | Cookie の代わりに Bearer トークンで API 認証 | `bearer({ requireSignature })` | 利用は慎重に（Cookie 推奨が基本） |
| **Device Authorization** | OAuth 2.0 デバイス認可グラント（RFC 8628） | `deviceAuthorization({ expiresIn, interval })` | CLI・スマート TV・IoT 向け |
| **Captcha** | サインアップ/イン/リセットにボット対策 | `captcha({ provider, secretKey, endpoints })` | Turnstile / reCAPTCHA / hCaptcha / CaptchaFox |
| **Have I Been Pwned** | 漏洩済みパスワードの利用を拒否 | `haveIBeenPwned()` | HIBP API で k-匿名性チェック |
| **i18n** | 認証エラーメッセージ等の多言語化 | （ロケール設定） | コミュニティ系。文言ローカライズ |
| **Last Login Method** | 最後に使った認証手段を記録・表示 | `lastLoginMethod({ cookieName, maxAge })` | 「前回は Google でログイン」表示 |
| **Multi-Session** | 同一ブラウザで複数アカウントの同時セッション | `multiSession({ maximumSessions })` | アカウント切替 UX |
| **OAuth Proxy** | OAuth リクエストをプロキシ（プレビュー環境向け） | `oAuthProxy({ productionURL, secret })` | redirect URL が事前に確定しない開発時 |
| **One-Time Token** | 単回使用トークンの生成・検証 | `oneTimeToken()` | クロスドメイン認証の受け渡し |
| **OpenAPI** | 全エンドポイントの OpenAPI 3.1.1 リファレンス（Scalar UI） | `openAPI({ path, theme })` | 開発初期段階。動作確認 UI 付き |
| **JWT** | JWT 発行 + JWKS 検証エンドポイント | `jwt({ jwks, jwt })` | セッションの代替ではない |
| **Test utilities** | 認証フローのテスト用ヘルパー | （テストインスタンス生成） | E2E/結合テストの足場 |

#### Captcha

`sign-up` / `sign-in` / `request-password-reset` などのエンドポイントにボット対策を挿入。`endpoints` で保護対象を上書きでき、reCAPTCHA v3 は `minScore`、hCaptcha/CaptchaFox は `siteKey` を追加指定する。

```ts
// auth.ts
import { captcha } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    captcha({
      provider: "cloudflare-turnstile", // google-recaptcha | hcaptcha | captchafox
      secretKey: process.env.TURNSTILE_SECRET_KEY!,
    }),
  ],
});
```

#### JWT

JWT トークンの取得エンドポイントと、検証用の **JWKS エンドポイント**を提供する。セッションの置き換えではなく、JWT を要求する外部サービス連携向け。鍵アルゴリズムは既定 `EdDSA`（ほか `ES256`・`RSA256`・`PS256` 等に変更可）。JWT・Bearer・セッションの基礎概念は [§01 コンセプト](01-concepts.html) にまとめている。

```ts
// auth.ts
import { jwt } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    jwt({
      jwks: {
        keyPairConfig: { alg: "EdDSA" },
      },
    }),
  ],
});
```

#### OpenAPI

コア＋全プラグインのエンドポイントを **OpenAPI 3.1.1** 仕様で出力し、Scalar 製 UI でブラウズ・実行テストできる。クライアント生成やドキュメント化に使う。

```ts
// auth.ts
import { openAPI } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    openAPI({
      path: "/reference", // リファレンス UI の公開パス
    }),
  ],
});
```

---

### Payment（決済・課金）

認証とユーザーは密結合（誰が何を契約しているか）なので、Better Auth は決済プロバイダを「ユーザー/組織に紐づく顧客・サブスク・使用量」として扱うプラグインを多数用意する。**Stripe と Polar は Better Auth 公式保守**、Autumn・Dodo・Creem・Chargebee・Commet は各ベンダー保守だが、いずれも公式ドキュメントにプラグインページを持つ。選定の軸は「直接 PSP か / MoR か / Stripe の上のビリング層か」「従量課金の要否」「グローバル税の丸投げ可否」「エンプラ要件」。

#### 位置づけ早見

| プラグイン | 課金モデル種別 | 主なターゲット | 税/VAT・コンプラの所在 | 保守 |
|---|---|---|---|---|
| **Stripe** | 直接 PSP | あらゆる規模・最大の柔軟性 | 自社（Stripe Tax は計算補助のみ） | 公式 |
| **Polar** | MoR（Stripe の上） | インディー・OSS・デジタル製品/SaaS | Polar が代行 | 公式（Polar） |
| **Autumn** | Stripe の上のビリング層（MoR でない） | AI/SaaS の従量・クレジット課金 | 自社（Stripe 側） | ベンダー |
| **Dodo Payments** | グローバル MoR | AI/SaaS・150+ カ国のグローバル販売 | Dodo が代行 | ベンダー |
| **Creem** | MoR | SaaS・インディーのグローバル販売 | Creem が代行 | ベンダー |
| **Chargebee** | サブスク/レベニュー管理層（PSP の上） | 複雑請求のエンタープライズ | 自社（税計算機能は内蔵） | ベンダー |
| **Commet** | MoR | AI/API・SaaS の従量課金 | Commet が代行 | ベンダー |

> **MoR（Merchant of Record）**とは、決済の法的な「販売者」を肩代わりして売上税/VAT の登録・計算・申告・納税とコンプライアンスを丸ごと引き受けるモデル。Polar / Dodo / Creem / Commet はこのタイプで、グローバル課税・インボイス・不正対策の実装負担を消す代わりに手数料が乗る。対して **Stripe は直接 PSP**（販売者は自社）、**Autumn は Stripe の上の課金レイヤー**、**Chargebee は PSP の上のサブスク管理層**で、いずれも税の最終責任は自社に残る。

#### Stripe

決済の世界標準にして最も汎用的な PSP。サブスクと決済を Better Auth のユーザーへ紐づける公式プラグイン。

- **位置づけ**: 直接決済の事実上の標準。エコシステムと API が最も広い。
- **課金モデル**: 直接 PSP（販売者は自社）。
- **主なターゲット**: スタートアップ〜大企業まで、細かい制御を自前で握りたいチーム全般。
- **際立つ特徴**: Billing・Connect（マーケットプレイス分配）・Invoicing・Checkout、巨大な API/SDK と連携先。
- **税/VAT・コンプラ**: 自社が販売者。Stripe Tax で税率計算は補助できるが、登録・申告・納税の責任は自社に残る。
- **いつ選ぶか**: 既存 Stripe 資産がある／きめ細かい制御が要る／税処理を自前か Stripe Tax で回せる。**不向き**: 各国 VAT 申告を丸ごと外注したい個人/小規模。
- **Better Auth でできること**: `createCustomerOnSignUp` で顧客自動作成、`subscription`（静的/動的 plans・`freeTrial`・`limits`・`subscription.upgrade` で差額のみ課金）、Webhook 自動処理（`checkout.session.completed` / `customer.subscription.created`・`updated`・`deleted`）、`onEvent` で任意イベント、`authorizeReference` で操作権限チェック。

```ts
// auth.ts
import { betterAuth } from "better-auth";
import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const auth = betterAuth({
  plugins: [
    stripe({
      stripeClient,
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: [
          { name: "basic", priceId: "price_123", limits: { projects: 5 } },
          { name: "pro", priceId: "price_456", freeTrial: { days: 14 } },
        ],
      },
    }),
  ],
});
```

```ts
// クライアントでプラン変更（差額のみ課金）
await authClient.subscription.upgrade({
  plan: "pro",
  successUrl: "/dashboard",
  cancelUrl: "/pricing",
  subscriptionId: "sub_123",
});
```

#### Polar

開発者ファーストの MoR 決済インフラ。Stripe の上に構築され、プロダクト自体も OSS。公式（Polar チーム）保守プラグイン。

- **位置づけ**: 「コードで売る」開発者向け MoR。デジタル製品の販売を最短距離で。
- **課金モデル**: MoR（Polar が販売者・売上税/VAT を代行）。内部的に Stripe の上に乗る。
- **主なターゲット**: インディー開発者・OSS メンテナ・SaaS・ライセンス/デジタル製品販売。
- **際立つ特徴**: GitHub 連携、**ベネフィット自動付与**（Discord/GitHub アクセス権、ライセンスキー発行、ファイル/ダウンロード配布）、Customer State、組織サポート。
- **税/VAT・コンプラ**: Polar が販売者として代行。
- **いつ選ぶか**: 税処理を丸投げしたい開発者、デジタル製品/ライセンス販売、購入特典の自動配布。**不向き**: 物理商品や複雑なエンプラ請求。
- **Better Auth でできること**: `createCustomerOnSignUp` と合成サブプラグイン `checkout` / `portal`（注文・サブスク・付与ベネフィットの管理）/ `usage`（メーター一覧・イベント取込で従量課金）/ `webhooks`。

```ts
// auth.ts
import { betterAuth } from "better-auth";
import { polar, checkout, portal, usage, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";

const polarClient = new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN! });

export const auth = betterAuth({
  plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [checkout({}), portal(), usage(), webhooks({})],
    }),
  ],
});
```

#### Autumn

SaaS のプライシングを動かす OSS 課金インフラ。アプリと Stripe の「間」に座り、サブスク状態の system of record になる。

- **位置づけ**: Stripe をラップする宣言的なプライシング/課金レイヤー。
- **課金モデル**: **Stripe の上のビリング層（MoR ではない）**。サブスク状態・使用量・クレジット・エンタイトルメントのデータベース。
- **主なターゲット**: AI/SaaS スタートアップ、従量・クレジット課金。
- **際立つ特徴**: feature flags + usage tracking + entitlements を宣言的に定義し、小さな API（`attach` / `check` / `track`）で操作。残高・使用量をリアルタイム参照でき、AI のトークン従量・クレジット残高表示と好相性。
- **税/VAT・コンプラ**: 下回りの **Stripe 側＝自社責任**。Autumn は税を肩代わりしない。
- **いつ選ぶか**: Stripe は残したまま、AI/SaaS の従量・クレジット・feature gating を宣言的に組みたい。**不向き**: 税丸投げ（MoR）が主目的のとき。
- **Better Auth でできること**: `autumn-js/better-auth` のサーバプラグイン＋クライアント（`autumn-js/react` の `useCustomer` 等）で、`attach`（プラン付与/チェックアウト）・`check`（エンタイトルメント確認＝機能ゲート）・`track`（使用量計測）を提供。

```ts
// auth.ts
import { betterAuth } from "better-auth";
import { autumn } from "autumn-js/better-auth";

export const auth = betterAuth({
  plugins: [autumn()], // attach / check / track を提供（下回りは Stripe）
});
```

#### Dodo Payments

AI-first 企業を狙うグローバル MoR（新興）。単一 API で世界展開を数分に縮める。

- **位置づけ**: 150+ カ国へ売るためのグローバル MoR。
- **課金モデル**: MoR。
- **主なターゲット**: AI/SaaS/デジタル製品、グローバル販売・新興市場。
- **際立つ特徴**: 単一 API で checkout / billing / payouts。クレジットベース課金・使用量メータリング・サブスク・グローバル決済を内蔵し、税/不正/コンプラに触れず展開できる。
- **税/VAT・コンプラ**: Dodo が販売者として代行。
- **いつ選ぶか**: グローバル販売を最速で立ち上げたい、税/コンプラを丸投げしたい AI/SaaS。**不向き**: 国内のみ・既存 Stripe で足りるとき。
- **Better Auth でできること**: `@dodopayments/better-auth`。`client` と `createCustomerOnSignUp`、合成サブプラグイン `use: [checkout, portal, webhooks]`。

```ts
// auth.ts
import { betterAuth } from "better-auth";
import { dodopayments, checkout, portal, webhooks } from "@dodopayments/better-auth";
import DodoPayments from "dodopayments";

const client = new DodoPayments({ bearerToken: process.env.DODO_API_KEY! });

export const auth = betterAuth({
  plugins: [
    dodopayments({
      client,
      createCustomerOnSignUp: true,
      use: [checkout(), portal(), webhooks()],
    }),
  ],
});
```

#### Creem

ソフトウェアをグローバル販売する「財務 OS」。税・コンプラ込みで Stripe の代替を狙う SaaS/インディー向け MoR。

- **位置づけ**: 税コンプラの頭痛なくグローバル販売する MoR。
- **課金モデル**: MoR。
- **主なターゲット**: SaaS・インディー、グローバル販売、共同制作のレベニュー分配。
- **際立つ特徴**: 決済・税・コンプラに加え**レベニュースプリット**（収益分配）を内蔵。Stripe より少ない手間で開始でき、`onCheckoutCompleted` などのイベントコールバックで購入/サブスクを処理。
- **税/VAT・コンプラ**: Creem が代行。
- **いつ選ぶか**: 税込みで手軽に売りたいインディー/SaaS、収益分配が要る。**不向き**: 複雑なエンタープライズ請求。
- **Better Auth でできること**: `@creem_io/better-auth`。`apiKey` / `webhookSecret`、`onCheckoutCompleted` 等のコールバックで権限付与・状態更新。

```ts
// auth.ts
import { betterAuth } from "better-auth";
import { creem } from "@creem_io/better-auth";

export const auth = betterAuth({
  plugins: [
    creem({
      apiKey: process.env.CREEM_API_KEY!,
      webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
      onCheckoutCompleted: async ({ customer, product, order }) => {
        // 購入完了時の処理（権限付与・一回払い商品の引き渡しなど）
      },
    }),
  ],
});
```

#### Chargebee

サブスクリプション/レベニュー管理の老舗。PSP ではなく、Stripe など PSP の上に乗る請求オーケストレーション層。

- **位置づけ**: 複雑な請求と収益認識を捌くエンタープライズ向けビリング基盤。
- **課金モデル**: **PSP の上のサブスク/レベニュー管理層**（MoR ではない）。
- **主なターゲット**: 複雑なプラン・多通貨・監査要件を抱えるエンタープライズ。
- **際立つ特徴**: プロレーション、多通貨、**レベニュー認識（RevRec）**、**ダニング（dunning）**、見積〜請求の自動化、複数 PSP の束ね。
- **税/VAT・コンプラ**: 税計算・管理機能は内蔵するが**販売者は自社**（MoR ではない）。
- **いつ選ぶか**: 複雑なプラン/プロレーション・複数 PSP・収益認識やコンプラ要件のあるエンタープライズ。**不向き**: 個人/小規模のシンプル課金（オーバースペック）。
- **Better Auth でできること**: `@chargebee/better-auth`（＋ `chargebee` クライアント）。`chargebeeClient`（`apiKey`・`site`）、`createCustomerOnSignUp`、Webhook の Basic 認証用 `webhookUsername` / `webhookPassword`。

```ts
// auth.ts
import { betterAuth } from "better-auth";
import { chargebee } from "@chargebee/better-auth";
import Chargebee from "chargebee";

const chargebeeClient = new Chargebee({
  apiKey: process.env.CHARGEBEE_API_KEY!,
  site: process.env.CHARGEBEE_SITE!,
});

export const auth = betterAuth({
  plugins: [
    chargebee({
      chargebeeClient,
      createCustomerOnSignUp: true,
      webhookUsername: process.env.CHARGEBEE_WEBHOOK_USERNAME,
      webhookPassword: process.env.CHARGEBEE_WEBHOOK_PASSWORD,
    }),
  ],
});
```

#### Commet

サブスク・従量課金・feature gating・税・グローバル決済をまとめる MoR。composable なサブプラグインで構成する。

- **位置づけ**: AI/API 課金を一気通貫で扱う MoR。
- **課金モデル**: MoR。
- **主なターゲット**: AI/API・SaaS の使用量ベース課金。
- **際立つ特徴**: 合成サブプラグイン `portal` / `subscriptions` / `features`（feature gating）/ `usage`（使用量メータリング）/ `seats`（席課金）で、課金と機能アクセス制御を一体化。
- **税/VAT・コンプラ**: Commet が代行（MoR）。
- **いつ選ぶか**: AI/API の従量課金に feature gating と seat 課金を足し、税まで MoR で一括したい。**不向き**: 単純な定額のみ。
- **Better Auth でできること**: `@commet/better-auth`（＋ `@commet/node`）。`commet({ client, use: [portal, subscriptions, features, usage, seats] })` で認証層と請求/機能アクセスを接続。

```ts
// auth.ts
import { betterAuth } from "better-auth";
import { commet, portal, subscriptions, features, usage, seats } from "@commet/better-auth";
import { Commet } from "@commet/node";

const client = new Commet({ apiKey: process.env.COMMET_API_KEY! });

export const auth = betterAuth({
  plugins: [
    commet({
      client,
      use: [portal(), subscriptions(), features(), usage(), seats()],
    }),
  ],
});
```

#### 選び方早見表

| 要件・状況 | 推奨 | 一言 |
|---|---|---|
| 税/VAT を丸投げ（MoR）したい | Polar / Dodo / Creem / Commet | 販売者を肩代わり。手数料と引き換えに税・コンプラ消滅 |
| 直接 PSP で最大の柔軟性が欲しい | Stripe | 標準・広範 API。税は自社（Stripe Tax で補助） |
| Stripe は残し AI/SaaS の従量・クレジットを組む | Autumn | 宣言的な entitlements＋使用量。MoR ではない |
| グローバル販売（150+ カ国）を最速で | Dodo Payments | 単一 API・新興市場対応の MoR |
| インディー/OSS でデジタル製品＋特典配布 | Polar | ライセンスキー・GitHub/Discord 付与が自動 |
| 収益分配（レベニュースプリット）込みで手軽に | Creem | 税込み MoR＋共同制作向け分配 |
| エンタープライズの複雑サブスク・収益認識 | Chargebee | プロレーション・RevRec・ダニング・多 PSP |
| AI/API の従量＋feature gating＋seat を MoR で | Commet | サブプラグインで課金と機能ゲートを一体化 |

#### 一次情報（決済プラグイン）

- Stripe プラグイン: <https://www.better-auth.com/docs/plugins/stripe>（公式: <https://stripe.com>）
- Polar プラグイン: <https://www.better-auth.com/docs/plugins/polar>（公式: <https://polar.sh>）
- Autumn プラグイン: <https://www.better-auth.com/docs/plugins/autumn>（公式: <https://useautumn.com>）
- Dodo Payments プラグイン: <https://www.better-auth.com/docs/plugins/dodopayments>（公式: <https://dodopayments.com>）
- Creem プラグイン: <https://www.better-auth.com/docs/plugins/creem>（公式: <https://creem.io>）
- Chargebee プラグイン: <https://www.better-auth.com/docs/plugins/chargebee>（公式: <https://www.chargebee.com>）
- Commet プラグイン: <https://www.better-auth.com/docs/plugins/commet>（公式: <https://commet.co>）

---

### その他

決済ではないビジネス連携、そして自作・コミュニティ製による拡張。

| 項目 | 役割 | 主な設定 | 備考 |
|---|---|---|---|
| **Dub** | Dub リンク経由のサインアップで**リードトラッキング** | `dubAnalytics({ dubClient })` | 決済ではない。OAuth リンキングも追加 |
| **自作プラグイン** | 独自エンドポイント・スキーマ・フックを定義 | `satisfies BetterAuthPlugin` | サーバ/クライアント両対応 |
| **コミュニティプラグイン** | 公式以外の多数の拡張 | 各パッケージ参照 | 用途特化の選択肢が豊富 |

#### Dub（リードトラッキング）

[Dub](https://dub.co/) のリンク経由のサインアップを計測してリードを追跡する。決済ではなくグロース/アナリティクス用途。OAuth リンキングのサポートも追加する。

```ts
// auth.ts
import { betterAuth } from "better-auth";
import { dubAnalytics } from "@dub/better-auth";
import { Dub } from "dub";

export const auth = betterAuth({
  plugins: [
    dubAnalytics({
      dubClient: new Dub(),
    }),
  ],
});
```

#### 自作プラグイン

`BetterAuthPlugin` を `satisfies` で満たすオブジェクトを返す関数として実装する。`createAuthEndpoint` で独自エンドポイントを追加し、`sessionMiddleware` や `requireResourceOwnership`（所有者検証ミドルウェア）などのヘルパーを組み合わせられる。独自テーブルが必要なら `schema` を宣言し、追加後に CLI で generate/migrate する。

```ts
// plugin.ts
import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import * as z from "zod";

export const myPlugin = () =>
  ({
    id: "my-plugin",
    endpoints: {
      hello: createAuthEndpoint(
        "/my-plugin/hello",
        { method: "POST", body: z.object({ name: z.string() }), use: [sessionMiddleware] },
        async (ctx) => ctx.json({ message: `hi ${ctx.body.name}` }),
      ),
    },
  }) satisfies BetterAuthPlugin;
```

#### コミュニティプラグイン

公式が保守するプラグイン以外に、コミュニティ製の拡張が多数公開されている。用途特化（特定プロバイダ・特定フレームワーク連携・特殊な認証フロー等）の選択肢を探すときは公式の一覧を参照する。自作したものを一覧に追加することもできる。

---

### 一次情報（公式ドキュメント）

- プラグイン総覧・自作ガイド: <https://www.better-auth.com/docs/concepts/plugins>
- Two-Factor (2FA): <https://www.better-auth.com/docs/plugins/2fa>
- Username: <https://www.better-auth.com/docs/plugins/username>
- Anonymous: <https://www.better-auth.com/docs/plugins/anonymous>
- Phone Number: <https://www.better-auth.com/docs/plugins/phone-number>
- Magic Link: <https://www.better-auth.com/docs/plugins/magic-link>
- Email OTP: <https://www.better-auth.com/docs/plugins/email-otp>
- Passkey: <https://www.better-auth.com/docs/plugins/passkey>
- Generic OAuth: <https://www.better-auth.com/docs/plugins/generic-oauth>
- One Tap: <https://www.better-auth.com/docs/plugins/one-tap>
- SIWE: <https://www.better-auth.com/docs/plugins/siwe>
- Admin: <https://www.better-auth.com/docs/plugins/admin>
- Agent Auth: <https://www.better-auth.com/docs/plugins/agent-auth>
- API Key: <https://www.better-auth.com/docs/plugins/api-key>
- MCP: <https://www.better-auth.com/docs/plugins/mcp>
- Organization: <https://www.better-auth.com/docs/plugins/organization>
- OIDC Provider: <https://www.better-auth.com/docs/plugins/oidc-provider>
- OAuth Provider: <https://www.better-auth.com/docs/plugins/oauth-provider>
- SSO: <https://www.better-auth.com/docs/plugins/sso>
- SCIM: <https://www.better-auth.com/docs/plugins/scim>
- Bearer: <https://www.better-auth.com/docs/plugins/bearer>
- Device Authorization: <https://www.better-auth.com/docs/plugins/device-authorization>
- Captcha: <https://www.better-auth.com/docs/plugins/captcha>
- Have I Been Pwned: <https://www.better-auth.com/docs/plugins/have-i-been-pwned>
- Last Login Method: <https://www.better-auth.com/docs/plugins/last-login-method>
- Multi-Session: <https://www.better-auth.com/docs/plugins/multi-session>
- OAuth Proxy: <https://www.better-auth.com/docs/plugins/oauth-proxy>
- One-Time Token: <https://www.better-auth.com/docs/plugins/one-time-token>
- OpenAPI: <https://www.better-auth.com/docs/plugins/open-api>
- JWT: <https://www.better-auth.com/docs/plugins/jwt>
- Stripe: <https://www.better-auth.com/docs/plugins/stripe>
- Polar: <https://www.better-auth.com/docs/plugins/polar>
- Dub: <https://www.better-auth.com/docs/plugins/dub>
- コミュニティプラグイン一覧: <https://www.better-auth.com/docs/plugins/community-plugins>
