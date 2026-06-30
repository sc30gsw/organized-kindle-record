# Infrastructure — 公式の有料運用レイヤー

> Better Auth 本体は OSS・無料のライブラリだ。だが本番運用では「管理 GUI・不正対策・メール配信・SSO/SCIM」といった、ライブラリだけでは埋まらない領域が必ず出てくる。それを公式のマネージドサービスが肩代わりするのが **Better Auth Infrastructure**。導入はプラグイン 1 行、コアは自前に持ったまま「運用知能」だけを買い足せる。

### 🎤 登壇メモ

- **つかみ**: 「認証ライブラリはタダ。じゃあ Better Auth は何で食ってるの?」——答えは**運用を売る**。コードは無料で配り、本番で誰もが詰まる管理・防御・配信を有料で肩代わりする。これが Infrastructure。
- **強調**: ①導入は `plugins: [dash()]` の**1 行**。②課金対象は認証そのものではなく、ダッシュボード・不正検知・メール配信といった**運用知能**。③だから **Auth0/Clerk とは思想が逆**——「全部ホスト」ではなく「**コアは自前、運用知能だけ買う**」。
- **10 分なら**: 「位置づけ（4 つの柱）」→「プラグイン 1 行のデモ」→「ビジネスモデル（Supabase 型）」の 3 点だけに絞る。各プラグインの設定オプション表は配布資料に逃がし、口頭では `dash()` / `sentinel()` が**何を肩代わりするか**だけ語る。

---

## 位置づけ — ライブラリが埋めない「運用」を肩代わりする

Better Auth のコア（`better-auth` 本体とプラグイン群）は OSS で無料、自前ホストが前提だ。サインイン・セッション・OAuth・組織管理といった**認証の機能**はこれで完結する。

しかし実運用に乗せると、認証ロジックとは別レイヤーの仕事が立ち上がってくる。

- ユーザー・組織・セッションを**眺めて操作する管理画面**が欲しい
- クレデンシャルスタッフィングやボット、使い捨てメールを**検知・遮断**したい
- 検証メール・パスワードリセット・招待メールを**確実に配信**したい
- エンタープライズ向けに **SSO/SAML・ディレクトリ同期（SCIM）・ログドレイン**を提供したい

これらは「認証ライブラリ」の責務というより「**認証基盤の運用**」の責務だ。Better Auth Infrastructure は、この運用レイヤーを公式のマネージドサービスとして提供する有料プロダクトで、自分でダッシュボードや不正検知パイプラインやメール基盤を構築・運用せずに済ませられる。

なお `dash()` / `sentinel()` も実体は **Better Auth のプラグイン**であり、[§03 プラグイン](03-plugins.html)で扱うプラグイン機構の上に載る。違いは「接続先が自分の DB ではなく公式のマネージドサービス（有料）である」点だけだ。

> Infrastructure は **4 つの柱**で構成される。Dashboard（管理 GUI と分析）・Security（不正対策＝`sentinel`）・Email & SMS（マネージド配信）・Enterprise（SSO/SAML・SCIM・ログドレイン・ロールベースのダッシュボードアクセス）。

---

## 導入はプラグイン 1 行

### 前提

1. 動作している [Better Auth](https://www.better-auth.com/docs/installation) のインストール
2. [Better Auth Infrastructure ダッシュボード](https://www.better-auth.com/dashboard)でのアカウント作成と **API キー**の発行

### インストール

`@better-auth/infra` パッケージを追加する。

```bash
npm install @better-auth/infra
```

### 環境変数

発行した API キーを本番環境変数に設定する。`BETTER_AUTH_API_KEY` のみが必須で、`BETTER_AUTH_API_URL` と `BETTER_AUTH_KV_URL` は任意（自前エンドポイントを指す場合のみ）。

```dotenv
# 必須: Better Auth Infrastructure の API キー
BETTER_AUTH_API_KEY=your_api_key_here
# 任意
BETTER_AUTH_API_URL=https://api.betterauth.com
BETTER_AUTH_KV_URL=https://kv.better-auth.com
```

### サーバー設定（プラグインを足すだけ）

基本は `dash()` をプラグイン配列に 1 行足すだけだ。

```ts
import { betterAuth } from "better-auth";
import { dash } from "@better-auth/infra";

export const auth = betterAuth({
  // ... 既存の Better Auth 設定
  plugins: [
    dash({
      apiKey: process.env.BETTER_AUTH_API_KEY,
    }),
  ],
});
```

**Pro プラン以上**なら、セキュリティ層 `sentinel()` も並べて有効化できる。

```ts
import { betterAuth } from "better-auth";
import { dash, sentinel } from "@better-auth/infra";

export const auth = betterAuth({
  plugins: [
    dash({ /* ... */ }),
    sentinel({
      apiKey: process.env.BETTER_AUTH_API_KEY,
    }),
  ],
});
```

### クライアント設定

クライアント側にも対応プラグインを足す。`sentinelClient` はデバイスフィンガープリントと PoW チャレンジの自動解決を担う。

```ts
import { createAuthClient } from "better-auth/client";
import { dashClient, sentinelClient } from "@better-auth/infra/client";

export const authClient = createAuthClient({
  plugins: [
    dashClient(),
    sentinelClient({
      autoSolveChallenge: true, // PoW チャレンジを自動で解く
    }),
  ],
});
```

> **Expo / React Native** の場合は `@better-auth/infra/client` ではなく `@better-auth/infra/native` から `dashClient` と `sentinelNativeClient` を import する。

`dash()` と `sentinel()` は独立して使えるが、両方を入れて初めて Infrastructure の全機能が揃う。

---

## アーキテクチャとデータの流れ

Infrastructure は「自分のアプリ（自前ホスト）」と「Better Auth Infra（マネージド）」の二者構成だ。**自分の DB とユーザーデータはあくまで自前**に残り、Infra 側が担うのは分析・検知・配信といった運用知能に限られる。

- **イベント送信（dash）**: サインアップ等が起きると、`dash()` が Better Auth 内部のフックに乗ってイベントを捕捉し、`apiUrl`（Infra API）へ送る。`kvUrl`（KV ストア）はキャッシュに使う。API/KV にはそれぞれタイムアウト（既定 3000ms / 1000ms）が設定され、Infra 側が遅延・障害でも認証フロー本体を止めない設計になっている。
- **リクエスト検査（sentinel）**: ログイン等のリクエスト時に、`sentinel()` が KV でレート制限カウンタやフィンガープリントを照合し、Infra API でクレデンシャルスタッフィング判定や HaveIBeenPwned 照合を行う。結果に応じて `log` / `challenge` / `block` のいずれかを適用する。
- **クライアント連携**: クライアントプラグインがフィンガープリント（`X-Visitor-Id` ヘッダ）を付与し、サーバーが PoW チャレンジを返したら自動で解いて `X-PoW-Solution` ヘッダで再送する。
- **管理 GUI**: Infra 側の Web ダッシュボードは、`dash()` が登録する `/dash/*` 管理エンドポイント群を叩いてユーザー・組織・セッションを操作する。
- **監査ログ**: 捕捉されたイベントは Infra 側に蓄積され、`/events/*` や `authClient.dash.getAuditLogs()` から照会できる。

> 流れを一言でいえば「自分のアプリで認証を回し、その傍らで Infra に**観測・判定・配信**を委譲する」構図だ。コアの主権は手放さない。

---

## コンポーネント詳細

### Dashboard プラグイン `dash()`

Better Auth インスタンスを Infrastructure に接続する中核プラグイン。**分析トラッキング・イベントログ・管理ダッシュボード API**を有効化する。

```ts
import { betterAuth } from "better-auth";
import { dash } from "@better-auth/infra";

export const auth = betterAuth({
  plugins: [
    dash({
      apiUrl: process.env.BETTER_AUTH_API_URL,
      kvUrl: process.env.BETTER_AUTH_KV_URL,
      apiKey: process.env.BETTER_AUTH_API_KEY,
    }),
  ],
});
```

#### 設定オプション（DashOptions）

| Option | Type | Description |
|---|---|---|
| `apiUrl` | `string` | Infrastructure API の URL |
| `kvUrl` | `string` | キャッシュ用 KV ストアの URL |
| `apiKey` | `string` | 認証用の API キー |
| `apiTimeout` | `number` | Infra API への HTTP タイムアウト（ms）。既定 `3000` |
| `kvTimeout` | `number` | KV への HTTP タイムアウト（ms）。既定 `1000` |
| `activityTracking` | `object` | アクティビティトラッキング設定 |

#### アクティビティトラッキング

有効化するとユーザースキーマに `lastActiveAt` 列が追加され、ユーザー操作のたびに自動更新される。更新間隔は DB 書き込み量に直結するため、高トラフィックなアプリでは間隔を長めに取る。

```ts
dash({
  apiKey: process.env.BETTER_AUTH_API_KEY,
  activityTracking: {
    enabled: true,
    updateInterval: 300000, // 更新間隔 ms（既定: 5 分）
  },
}),
```

有効化後は DB マイグレーションの実行を忘れずに（追加されるスキーマ拡張は下記）。

```ts
user: {
  fields: {
    lastActiveAt: {
      type: "date",
    },
  },
}
```

#### 自動イベントトラッキング

`dash()` を入れるだけで、認証イベントが追加設定なしに記録される。捕捉されるイベントの全カタログは後述の [Audit Logs](#audit-logs--認証イベントの追跡と照会) を参照。ユーザー・セッション・アカウント・検証・組織（organization プラグイン使用時）の各カテゴリが自動で収集される。

#### 管理ダッシュボード API エンドポイント

`dash()` はダッシュボード用に多数の管理エンドポイントを登録する。ここに Infrastructure のエンタープライズ機能（SSO・SCIM ディレクトリ同期・ログドレイン）も API として現れる。

**ユーザー管理**

| Endpoint | Method | Description |
|---|---|---|
| `/dash/users` | GET | ユーザー一覧（ページング） |
| `/dash/users/online-count` | GET | オンラインユーザー数 |
| `/dash/user` | GET / POST / PATCH / DELETE | ユーザーの取得・作成・更新・削除 |
| `/dash/user/ban` | POST | ユーザーを BAN |
| `/dash/user/unban` | POST | BAN 解除 |
| `/dash/user/password` | POST | パスワード設定 |
| `/dash/user/impersonate` | POST | なりすまし（代理ログイン） |

**セッション管理**

| Endpoint | Method | Description |
|---|---|---|
| `/dash/sessions` | GET / DELETE | セッション一覧・削除 |
| `/dash/session/revoke` | POST | 単一セッションを失効 |
| `/dash/sessions/revoke-all` | POST | ユーザーの全セッションを失効 |

**組織・チーム・招待管理**

| Endpoint | Method | Description |
|---|---|---|
| `/dash/organizations` | GET | 組織一覧 |
| `/dash/organization` | GET / POST / PATCH / DELETE | 組織の取得・作成・更新・削除 |
| `/dash/organization/members` | GET | メンバー一覧 |
| `/dash/organization/member` | POST / DELETE | メンバー追加・削除 |
| `/dash/organization/member/role` | PATCH | メンバーのロール更新 |
| `/dash/organization/teams` | GET | チーム一覧 |
| `/dash/organization/team` | POST / PATCH / DELETE | チームの作成・更新・削除 |
| `/dash/organization/team/member` | POST / DELETE | チームメンバー追加・削除 |
| `/dash/organization/invitations` | GET | 招待一覧 |
| `/dash/organization/invite` | POST | 招待送信 |
| `/dash/organization/invite/cancel` | POST | 招待取り消し |
| `/dash/organization/invite/resend` | POST | 招待再送 |

**エンタープライズ（SSO・ディレクトリ同期・ログドレイン）**

| Endpoint | Method | Description |
|---|---|---|
| `/dash/organization/sso-providers` | GET | SSO プロバイダ一覧 |
| `/dash/organization/sso-provider` | POST / PATCH / DELETE | SSO プロバイダの作成・更新・削除 |
| `/dash/organization/sso-provider/verify-domain` | POST | ドメイン検証 |
| `/dash/organization/directories` | GET | ディレクトリ一覧（SCIM） |
| `/dash/organization/directory` | POST / DELETE | ディレクトリの作成・削除 |
| `/dash/organization/directory/token` | POST | トークン再生成 |
| `/dash/organization/log-drains` | GET | ログドレイン一覧 |
| `/dash/organization/log-drain` | POST / PATCH / DELETE | ログドレインの作成・更新・削除 |
| `/dash/organization/log-drain/test` | POST | ログドレインのテスト |

**イベント・分析・2FA**

| Endpoint | Method | Description |
|---|---|---|
| `/events/list` | GET | ユーザーイベント取得 |
| `/events/audit-logs` | GET | 監査ログ取得 |
| `/events/types` | GET | イベント種別取得 |
| `/dash/stats` | GET | ユーザー統計 |
| `/dash/graph` | GET | グラフデータ |
| `/dash/retention` | GET | リテンションデータ |
| `/dash/map` | GET | 地理データ |
| `/dash/user/2fa/enable` | POST | 2FA 有効化 |
| `/dash/user/2fa/disable` | POST | 2FA 無効化 |
| `/dash/user/2fa/totp-uri` | GET | TOTP URI 取得 |
| `/dash/user/2fa/backup-codes` | GET | バックアップコード閲覧 |
| `/dash/user/2fa/backup-codes/generate` | POST | バックアップコード再生成 |

#### クライアント統合（dashClient）

クライアントプラグインからは監査ログ照会 API が使える。ユーザー ID の解決ロジックは `resolveUserId` でカスタマイズできる。

```ts
dashClient({
  resolveUserId: ({ userId, user, session }) => {
    return userId || user?.id || session?.user?.id;
  },
}),
```

#### ベストプラクティス

1. **API キーは必ず設定する** — ないと Infra API と通信できない。
2. **アクティビティトラッキングの間隔は慎重に** — 更新間隔が DB 書き込み量を左右する。
3. **監査ログの保持期間はプラン依存** — 自分のプラン上限を確認する。
4. **エンドポイントを保護する** — ダッシュボードエンドポイントは認証必須。操作者に適切な権限を割り当てる。

---

### Security プラグイン `sentinel()`

認証システムへの**包括的な不正対策**を提供するプラグイン（**Pro プラン以上**）。クレデンシャルスタッフィング・不可能移動（impossible travel）・無料トライアル悪用などの攻撃ベクトルを検知・防御する。

```ts
import { betterAuth } from "better-auth";
import { sentinel } from "@better-auth/infra";

export const auth = betterAuth({
  plugins: [
    sentinel({
      security: {
        // ここに各種セキュリティ機能を設定
      },
    }),
  ],
});
```

#### 設定オプション（SentinelOptions）

| Option | Type | Description |
|---|---|---|
| `apiUrl` | `string` | Infrastructure API の URL |
| `kvUrl` | `string` | レート制限データ用 KV ストアの URL |
| `apiKey` | `string` | 認証用 API キー |
| `apiTimeout` | `number` | Infra API への HTTP タイムアウト（ms）。既定 `3000` |
| `kvTimeout` | `number` | KV への HTTP タイムアウト（ms）。既定 `1000` |
| `security` | `SecurityOptions` | セキュリティ機能の設定 |

`security` の構造（各機能は個別に有効化できる）。アクションは `"log"`（記録のみ）・`"challenge"`（PoW チャレンジ）・`"block"`（遮断）の 3 段階。

```ts
interface SecurityOptions {
  unknownDeviceNotification?: boolean;
  credentialStuffing?: CredentialStuffingConfig;
  impossibleTravel?: ImpossibleTravelConfig;
  geoBlocking?: GeoBlockingConfig;
  botBlocking?: boolean | { action: SecurityAction };
  suspiciousIpBlocking?: boolean | { action: SecurityAction };
  velocity?: VelocityConfig;
  freeTrialAbuse?: FreeTrialAbuseConfig;
  compromisedPassword?: CompromisedPasswordConfig;
  emailValidation?: EmailValidationConfig;
  emailNormalization?: { enabled?: boolean };
  staleUsers?: StaleUsersConfig;
  challengeDifficulty?: number;
}

type SecurityAction = "log" | "challenge" | "block";
```

#### クレデンシャルスタッフィング対策

ビジターごとにログイン失敗回数を追跡し、しきい値超過でチャレンジ→遮断する。

```ts
sentinel({
  apiKey: process.env.BETTER_AUTH_API_KEY,
  security: {
    credentialStuffing: {
      enabled: true,
      thresholds: {
        challenge: 3, // 3 回失敗で PoW チャレンジ
        block: 5,     // 5 回失敗で遮断
      },
      windowSeconds: 3600,  // 1 時間ウィンドウ
      cooldownSeconds: 900, // 遮断後 15 分のクールダウン
    },
  },
}),
```

動作: ビジター ID ごとに失敗回数を追跡 → チャレンジしきい値で PoW を発行 → 遮断しきい値でビジターを遮断 → ログイン成功で失敗カウントを自動クリア。

#### 不可能移動（impossible travel）検知

地理的に離れた地点からの、物理的にあり得ない短時間でのログインを検知する。

```ts
sentinel({
  apiKey: process.env.BETTER_AUTH_API_KEY,
  security: {
    impossibleTravel: {
      enabled: true,
      maxSpeedKmh: 1000,   // 現実的な最大移動速度
      action: "challenge",
    },
  },
}),
```

例: ニューヨークでログインした 30 分後に東京からログインすると、1000 km/h を超える移動が必要なため不可能移動としてフラグが立つ。

#### 無料トライアル悪用防止

デバイスフィンガープリントを使い、複数アカウント作成によるトライアル乱用を防ぐ。

```ts
sentinel({
  apiKey: process.env.BETTER_AUTH_API_KEY,
  security: {
    freeTrialAbuse: {
      enabled: true,
      thresholds: { challenge: 2, block: 3 },
      maxAccountsPerVisitor: 3,
      action: "block",
    },
  },
}),
```

#### 漏洩パスワード検知

HaveIBeenPwned データベースと照合して漏洩済みパスワードを検知する。**k-匿名性**を用い、パスワードハッシュの先頭 5 文字のみを送信する（フルパスワードは送らない）。

```ts
sentinel({
  apiKey: process.env.BETTER_AUTH_API_KEY,
  security: {
    compromisedPassword: {
      enabled: true,
      action: "block",
      minBreachCount: 1, // 検知に必要な最小漏洩回数
    },
  },
}),
```

#### 休眠アカウント監視

長期休眠していたアカウントが突然アクティブ化したのを検知する（アカウント乗っ取りの兆候）。ユーザー・管理者へのメール通知を出せる（通知には時刻・場所・休眠日数・デバイス情報を含む）。

```ts
sentinel({
  apiKey: process.env.BETTER_AUTH_API_KEY,
  security: {
    staleUsers: {
      enabled: true,
      staleDays: 90,
      action: "log",
      notifyUser: true,
      notifyAdmin: true,
      adminEmail: "admin@yourapp.com",
    },
  },
}),
```

#### その他の検知機能

- **ジオブロッキング** — `allowList`（許可国）または `denyList`（遮断国）で国単位の許可/遮断。ISO 3166-1 alpha-2 の国コードを使う。
- **ボットブロッキング** — `botBlocking: true`、または `{ action: "challenge" }` 等で自動化トラフィックを検知・遮断。
- **不審 IP 検知** — `suspiciousIpBlocking` で既知の悪性 IP からのリクエストを遮断。
- **ベロシティ / レート制限** — `velocity` で各種操作の速度を制限（`maxSignupsPerVisitor` / `maxPasswordResetsPerIp` / `maxSignInsPerIp` / `windowSeconds` など）。
- **メール検証** — `emailValidation` で使い捨てメールを遮断。`strictness` は `low`（既知の使い捨てドメインのみ）/ `medium`（MX レコード確認も）/ `high`（追加のヒューリスティック）。
- **メール正規化** — `emailNormalization` で小文字化・プラスタグ除去（`user+tag@gmail.com` → `user@gmail.com`）・Gmail のドット除去・`googlemail.com` → `gmail.com` を行い、エイリアスによる重複アカウントを防ぐ。`emailValidation` と独立して制御できる。

```ts
sentinel({
  apiKey: process.env.BETTER_AUTH_API_KEY,
  security: {
    velocity: {
      enabled: true,
      thresholds: { challenge: 10, block: 20 },
      maxSignupsPerVisitor: 5,
      maxPasswordResetsPerIp: 10,
      maxSignInsPerIp: 50,
      windowSeconds: 3600,
      action: "challenge",
    },
    emailValidation: {
      enabled: true,
      strictness: "medium",
      action: "block",
    },
  },
}),
```

#### Proof-of-Work（PoW）チャレンジ

アクションが `"challenge"` のとき、Sentinel はクライアントが解くべき PoW チャレンジを発行する。サーバーが暗号学的チャレンジを出し、クライアントが難易度条件を満たす解を探す。**計算は重いが検証は速い**ため、自動攻撃を抑えつつ正規ユーザーは通過できる。難易度は `challengeDifficulty`（既定 `18`）で調整し、高いほど攻撃者の計算コストが上がる。

```ts
sentinel({
  apiKey: process.env.BETTER_AUTH_API_KEY,
  security: {
    challengeDifficulty: 18,
  },
}),
```

#### クライアント統合（sentinelClient）

クライアントプラグインがデバイスフィンガープリントと PoW 自動解決を担う。`X-Visitor-Id` ヘッダでビジター ID を付与し（クレデンシャルスタッフィング検知・無料トライアル悪用防止・デバイス追跡に使用）、解いたチャレンジは `X-PoW-Solution` ヘッダで送る。

| Option | Type | Default | Description |
|---|---|---|---|
| `autoSolveChallenge` | `boolean` | `true` | PoW チャレンジを自動で解く |
| `kvTimeout` | `number` | `1000` | KV identify 等の HTTP タイムアウト（ms） |

Expo / React Native では `@better-auth/infra/native` の `sentinelNativeClient` を使う。`onChallengeReceived` / `onChallengeSolved` / `onChallengeFailed` のコールバックや、永続的なビジター ID 用の `storage`（Async Storage 等）を指定できる。

#### セキュリティイベント

Sentinel が検知すると、監査ログに以下の `security_*` イベントが記録され Security ダッシュボードに表示される。

| Event Type | Description |
|---|---|
| `security_blocked` | リクエストを遮断 |
| `security_allowed` | チャレンジ通過後に許可 |
| `security_credential_stuffing` | クレデンシャルスタッフィング検知 |
| `security_impossible_travel` | 不可能移動検知 |
| `security_geo_blocked` | ジオブロッキング発動 |
| `security_bot_blocked` | ボット検知・遮断 |
| `security_suspicious_ip` | 不審 IP 検知 |
| `security_velocity_exceeded` | レート制限超過 |
| `security_free_trial_abuse` | 無料トライアル悪用検知 |
| `security_compromised_password` | 漏洩パスワード検知 |
| `security_stale_account` | 休眠アカウント再活性化 |

#### ベストプラクティス

1. **まず `log` から始める** — いきなり遮断せず、トラフィックパターンを把握する。
2. **しきい値を調整する** — アプリごとに最適値は違う。誤検知を監視して調整する。
3. **遮断より先にチャレンジ** — 正規ユーザーを通しつつ自動攻撃を止める。
4. **クライアント自動解決を有効化** — `autoSolveChallenge: true` を使う。
5. **セキュリティイベントを定期レビュー** — 攻撃パターンを把握する。
6. **重大イベントは管理者通知** — 休眠アカウント再活性化などで `notifyAdmin` を有効化する。

---

### Audit Logs — 認証イベントの追跡と照会

`dash()` を入れた時点で、認証イベントは**追加設定なしに自動収集**される。`dash()` が Better Auth インスタンスのフックに接続し、サインアップ・サインイン・パスワード変更などをイベント発生と同時に記録する。手動の計装は不要。

#### 追跡されるイベント（全カタログ）

**ユーザー / セッション / アカウント / 検証**

| Event | Trigger |
|---|---|
| `user_signed_up` | 新規登録 |
| `user_profile_updated` | プロフィール更新 |
| `user_profile_image_updated` | アバター変更 |
| `user_email_verified` | メール検証完了 |
| `user_banned` / `user_unbanned` | BAN / BAN 解除 |
| `user_deleted` | アカウント削除 |
| `user_signed_in` / `user_signed_out` | サインイン / サインアウト |
| `session_created` / `session_revoked` | セッション作成 / 単一失効 |
| `sessions_revoked_all` | 全セッション失効 |
| `user_impersonated` / `user_impersonation_stopped` | なりすまし開始 / 終了 |
| `account_linked` / `account_unlinked` | ソーシャル連携 / 解除 |
| `password_changed` | パスワード更新 |
| `password_reset_requested` / `password_reset_completed` | リセット開始 / 完了 |
| `email_verification_sent` | 検証メール送信 |

**組織（organization プラグイン使用時）**

| Event | Trigger |
|---|---|
| `organization_created` / `organization_updated` | 組織の作成 / 更新 |
| `member_added` / `member_removed` | メンバー追加 / 削除 |
| `member_role_updated` | ロール変更 |
| `member_invited` | 招待送信 |
| `invite_accepted` / `invite_rejected` / `invite_cancelled` | 招待の承諾 / 拒否 / 取消 |
| `team_created` / `team_updated` / `team_deleted` | チームの作成 / 更新 / 削除 |
| `team_member_added` / `team_member_removed` | チームメンバー追加 / 削除 |

> セキュリティイベント（`security_*`）は `sentinel()` 使用時に追加される（前掲の表）。

#### クライアントからの照会

`dashClient()` を追加すると 2 つの照会 API が使える。

- **`getAuditLogs`** — **現在のユーザー**の監査イベントを返す（組織のメンバーとして `organizationId` を渡せば組織スコープに絞れる）。一般メンバーのアクティビティ表示向け。
- **`getAllAuditLogs`** — 呼び出しユーザーが **admin / owner** 権限を持つ組織の全監査イベントを返す。ロール評価に [organization プラグイン](https://www.better-auth.com/docs/plugins/organization)が必須。管理者ダッシュボード向け。

```ts
const session = await authClient.getSession();

const logs = await authClient.dash.getAuditLogs({
  session: session.data,
  limit: 50,
  offset: 0,
});

logs.data?.events; // 監査ログイベントの配列
logs.data?.total;  // 総件数
logs.data?.limit;  // ページサイズ
logs.data?.offset; // 現在のオフセット
```

主なクエリパラメータ。`limit` は最大 `100`・既定 `50`、`offset` 既定 `0`。`eventType` / `organizationId` / `userId` / `identifier`（メール等の一意値）で絞り込めて、組み合わせも可能。

| Parameter | Type | Description |
|---|---|---|
| `limit` | `number` | 1 ページの件数（最大 100、既定 50） |
| `offset` | `number` | ページングのオフセット（既定 0） |
| `organizationId` | `string` | 組織で絞り込み |
| `userId` | `string` | ユーザー ID で絞り込み |
| `eventType` | `string` | イベント種別で絞り込み |
| `identifier` | `string` | 識別子（メール等）で絞り込み |
| `session` | `object` | user を含むセッションオブジェクト |

イベント種別での絞り込み例。

```ts
const signIns = await authClient.dash.getAuditLogs({
  session: session.data,
  eventType: "user_signed_in",
});
```

ページネーションは `limit` / `offset` のループで全件取得できる。

```ts
async function fetchAllUserAuditLogEvents(session: unknown) {
  const limit = 100;
  let offset = 0;
  const allEvents = [];

  while (true) {
    const result = await authClient.dash.getAuditLogs({
      session: session.data,
      limit,
      offset,
    });

    const events = result.data?.events ?? [];
    allEvents.push(...events);

    if (events.length < limit) break;
    offset += limit;
  }

  return allEvents;
}
```

> 監査ログの**保持期間はプラン依存**。エンタープライズ層ではログドレイン（`/dash/organization/log-drain`）で SIEM へ転送し、長期保管・相関分析に回せる。

---

### Email Service — マネージドなトランザクションメール配信

検証・リセット・招待などの認証メールを、メール基盤を自前で運用せずに送れるマネージドサービス。**プロ仕様の組み込みテンプレート**、複数プロバイダ対応（AWS SES / SendGrid / Resend）、型安全なテンプレート変数、配信最適化を提供する。

#### 送信 API

`@better-auth/infra` に同梱。単発送信の `sendEmail` と、設定を固定した再利用センダーを作る `createEmailSender` がある。

```ts
import { sendEmail, createEmailSender } from "@better-auth/infra";

// 単発送信
await sendEmail({
  template: "verify-email",
  to: "user@example.com",
  variables: {
    verificationUrl: "https://yourapp.com/verify?token=abc123",
    userEmail: "user@example.com",
    userName: "John",
    appName: "Your App",
  },
});

// 再利用センダー
const emailSender = createEmailSender({
  apiKey: process.env.BETTER_AUTH_API_KEY,
  apiUrl: process.env.BETTER_AUTH_API_URL,
});

await emailSender.send({
  template: "reset-password",
  to: "user@example.com",
  variables: {
    resetLink: "https://yourapp.com/reset?token=xyz",
    userEmail: "user@example.com",
  },
});
```

API キー・URL は環境変数（`BETTER_AUTH_API_KEY` / 任意で `BETTER_AUTH_API_URL`）から自動で読まれる。戻り値は `{ success, messageId?, error? }` の `SendEmailResult`。

#### 利用可能なテンプレート

| Template | 用途 |
|---|---|
| `verify-email` | 新規ユーザーへのメール検証リンク |
| `reset-password` | パスワードリセットリンク |
| `change-email` | メールアドレス変更の確認 |
| `sign-in-otp` | パスワードレスサインイン用 OTP |
| `verify-email-otp` | メール検証用 OTP コード |
| `reset-password-otp` | パスワードリセット用 OTP コード |
| `magic-link` | パスワードレス認証のマジックリンク |
| `two-factor` | 二要素認証コード |
| `invitation` | 組織への招待 |
| `application-invite` | アプリ（プラットフォーム）への招待 |
| `delete-account` | アカウント削除の確認 |
| `stale-account-user` | 休眠アカウントへのアクセス通知（ユーザー向け） |
| `stale-account-admin` | 休眠アカウント再活性化の通知（管理者向け） |

各テンプレートは型安全な `variables` を受け取る。例えば `invitation` は招待リンク・招待者名/メール・組織名・ロール等を渡す。

```ts
await sendEmail({
  template: "invitation",
  to: "newmember@example.com",
  variables: {
    inviteLink: "https://yourapp.com/invite?token=abc",
    inviterName: "John Smith",
    inviterEmail: "john@company.com",
    organizationName: "Acme Corp",
    role: "Member",
    appName: "Your App",   // 任意
    expirationDays: "7",   // 任意
  },
});
```

#### Better Auth の認証フローとの統合

Better Auth 側のコールバック（`sendResetPassword` / `sendVerificationEmail` / `organization` プラグインの `sendInvitationEmail`）から `sendEmail` を呼ぶだけで、認証フローに自然に組み込める。

```ts
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { sendEmail } from "@better-auth/infra";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    async sendResetPassword({ user, url }) {
      await sendEmail({
        template: "reset-password",
        to: user.email,
        variables: { resetLink: url, userEmail: user.email, userName: user.name, appName: "Your App" },
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    async sendVerificationEmail({ user, url }) {
      await sendEmail({
        template: "verify-email",
        to: user.email,
        variables: { verificationUrl: url, userEmail: user.email, userName: user.name, appName: "Your App" },
      });
    },
  },
  plugins: [
    organization({
      async sendInvitationEmail(data) {
        const inviteLink = `https://yourapp.com/accept-invitation/${data.id}`;
        await sendEmail({
          template: "invitation",
          to: data.email,
          variables: {
            inviteLink,
            inviterName: data.inviter.user.name,
            inviterEmail: data.inviter.user.email,
            organizationName: data.organization.name,
            role: data.role,
            appName: "Your App",
          },
        });
      },
    }),
  ],
});
```

> **本番では送信を `await` で待たない**ことが推奨される（タイミング攻撃の回避）。サーバーレスでは `waitUntil` 等を使い、レスポンスをブロックせずに送信を完了させる。トランザクションメールは **Pro プラン以上**で利用可能。

---

## ビジネスモデル — OSS コア + Infrastructure = Supabase 型

Better Auth の収益構造は **Supabase 型**だ。

- **OSS コア（無料）で普及を取る** — `better-auth` 本体とプラグインは OSS。学習コストの低さと型安全・網羅性で開発者に広く使われ、エコシステムを育てる。
- **Infrastructure（有料）で収益化する** — その上で「自前運用すると重い領域」（管理 GUI・不正検知・メール配信・SSO/SCIM・ログドレイン）をマネージドサービスとして売る。普及した OSS が**販売チャネル**そのものになる。

これは Auth0 / Clerk の「全部ホスト」モデルとは思想が違う。

| 観点 | Auth0 / Clerk（全部ホスト） | Better Auth + Infrastructure |
|---|---|---|
| 認証コア | ベンダーがホスト | **自前ホスト（OSS・無料）** |
| ユーザーデータ | ベンダー側 | **自前 DB に所有** |
| 課金対象 | 認証そのもの（MAU 等） | 運用知能（分析・不正対策・配信） |
| 採用の起点 | 営業・サインアップ | OSS の普及 |
| ロックイン | 強い（移行が重い） | 弱い（コアは手元、有料層は着脱式） |

ポイントは「**コアは自前、運用知能だけ買う**」という分離だ。認証ロジックとユーザーデータの主権を手放さないまま、ダッシュボードや不正検知だけを Infra に委譲できる。

ただし利便性ゆえに**寄せすぎるとロックインの芽が生まれる**点には注意が必要だ（[§08 デメリット](08-cons.html) でも触れたとおり、有料層への依存はロックインの芽になる）。どこまでを有料層に委ねるかは設計段階で線引きし、「自前ホストだから自由」という当初の利点を保てるバランスを保つのがよい。

---

## 一次情報

- Introduction: <https://www.better-auth.com/docs/infrastructure/introduction>
- Getting Started: <https://www.better-auth.com/docs/infrastructure/getting-started>
- Dashboard プラグイン（dash）: <https://www.better-auth.com/docs/infrastructure/plugins/dash>
- Security プラグイン（sentinel）: <https://www.better-auth.com/docs/infrastructure/plugins/sentinel>
- Audit Logs: <https://www.better-auth.com/docs/infrastructure/plugins/audit-logs>
- Email Service: <https://www.better-auth.com/docs/infrastructure/services/email>
