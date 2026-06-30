# Introduction — Better Auth とは / 比較 / Auth.js 合流

> Better Auth は「自分のサーバー・自分の DB で動く」TypeScript 製のオープンソース認証ライブラリ。本章ではその立ち位置を、丸ごとホスト型 SaaS との対比、競合との比較表、そして 2025 年の Auth.js 合流という業界ニュースから整理する。

---

### 🎤 登壇メモ

- **つかみ**: 「あなたが今使っている NextAuth / Auth.js、その進化の主役はもう Better Auth に移りつつある」— ニュースから入る。
- **強調**: 二択の本質は **「データを誰が持つか」**。SaaS（Clerk/Auth0）は預ける、Better Auth は **自分の DB に持つ**。
- **10分なら**: 比較表は全部読まない。**Clerk（SaaS代表）と Auth.js（OSS前任）の2社だけ**を引き合いに出して先へ。
- この章は導入。機能の網羅は（→ [§03 プラグイン大全](03-plugins.html)）、山場の AI は（→ [§07 AI Resources](07-ai-resources.html)）、弱点は（→ [§08 デメリット](08-cons.html)）で扱う。

---

## 二層構造で捉える: ホスト型 SaaS か、自前ライブラリか

```text
  ┌──────────────── 丸ごとホスト型 SaaS ────────────────┐
  │  Clerk / Auth0 / Cognito / Firebase Auth            │
  │  ・認証画面もユーザー DB も「相手のサーバー」         │
  │  ・楽。が、データを預ける／ロックイン／従量課金       │
  └─────────────────────────────────────────────────────┘
                          vs
  ┌──────────────── 自前ホスト型ライブラリ ──────────────┐
  │  Better Auth / Auth.js / Lucia                       │
  │  ・コードとして自分のアプリに同梱                     │
  │  ・ユーザー & セッションは【自分の DB】               │
  │  ・自由・低コスト・データ所有。運用責任は自分          │
  └─────────────────────────────────────────────────────┘
```

> 一言: **「運用知能を買う」か「コードを持つ」か。** Better Auth は後者で、必要なら運用層だけ別売り（→ [§06 Infrastructure](06-infrastructure.html)）で買い足せる。

---

## Better Auth とは何か

**Better Auth** は、TypeScript 向けの **framework-agnostic（フレームワーク非依存）** な認証・認可フレームワークである。Next.js / React / Vue / SvelteKit / Nuxt / Astro / Hono など、特定のフレームワークに縛られず動作する。

公式の定義はこうだ。

> Better Auth is a framework-agnostic, universal authentication and authorization framework for TypeScript. It provides a comprehensive set of features out of the box and includes a plugin ecosystem that simplifies adding advanced functionalities.

要点を日本語で噛み砕くと:

- **自前ホスト（self-hosted）**: 認証ロジックは自分のサーバー上で動き、ユーザー・セッションのデータは自分の DB（PostgreSQL / MySQL / SQLite など）に保存される。外部の認証 SaaS に依存しない。
- **comprehensive な標準機能**: email & password、OAuth ソーシャルログイン、セッション管理などを箱から出してすぐ使える。
- **plugin ecosystem**: 2FA、passkey（WebAuthn）、multi-tenancy（organization）、multi-session、SSO（SAML / OIDC）、自前 IDP 構築といった高度な機能をプラグインで追加できる。「車輪の再発明」をせずアプリ本体の開発に集中できる、という思想。
- **MIT ライセンスの OSS**: 無料で、用途に制限がない。

### 最小コード例

サーバー側で `betterAuth({...})` を呼ぶだけで、認証のコア（ルートハンドラ・DB スキーマ・API）が立ち上がる。以下は email & password と GitHub ソーシャルログインを有効化した最小構成。

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
  },
});
```

クライアント側は `createAuthClient()` を呼ぶだけで、型付きの `signIn` / `signUp` / `useSession` などが手に入る。サーバーの設定から型が推論されるため、エンドポイントとクライアント呼び出しが TypeScript で一気通貫に型安全になる。

```ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

// 使い方の例
await authClient.signIn.email({ email, password });
const { data: session } = authClient.useSession();
```

> ポイント: 設定は「ダッシュボードの GUI」ではなく **コード（auth.ts）** に集約される。Git で差分が追え、レビューでき、環境ごとに再現できる。これが SaaS 型との最大の体験差になる。

---

## 認証の2流派 — ホスト型 SaaS vs 自前ホスト型ライブラリ

認証の実装方式は、大きく2つの流派に分けられる。どちらが「正解」ということはなく、**データ所有・自由・運用責任のトレードオフ**をどう取るかの選択である。

### 1. 丸ごとホスト型 SaaS（Managed / Hosted）

代表例: **Auth0**、**Clerk**、**Amazon Cognito**、**Firebase Authentication**、**Kinde**、**WorkOS**。

- ユーザーレコード・セッションストア・署名鍵（signing keys）は **ベンダー側のインフラ**に置かれる。
- プリビルトの UI、SDK、ダッシュボードが揃い、**立ち上げが速い**。
- 運用（可用性・スケール・パッチ）はベンダー任せ。自分でサーバーを持たなくてよい。
- 反面、**データを自分で持てない**、料金が MAU（月間アクティブユーザー）従量で青天井になりがち、そして **vendor lock-in**（移行困難）のリスクを負う。

> Clerk の評価として、ある比較記事はこう端的に述べている。「セットアップは最速だが、その代償としてセッションストア・ユーザーレコード・署名鍵を自分では所有できない（you do not own the session store, the user records, or the signing keys）」。

### 2. 自前ホスト型ライブラリ（Self-hosted Library）

代表例: **Better Auth**、**Auth.js（旧 NextAuth）**、**Lucia**。

- 認証ロジックは自分のアプリ／サーバーで動き、データは **自分の DB** に入る。
- **完全なデータ所有**と、認証フローの細部までの **full control** が得られる。セッションの即時失効（immediate revocation）も自分で制御できる。
- 設定はコードに集約され、再現性・監査性が高い。
- 反面、**運用責任は自分持ち**。「フルオーナーシップ、フルレスポンシビリティ（Full ownership, full responsibility）」というトレードオフになる。

この2流派の違いを一言でいえば、**「速さと無手間（SaaS）」を取るか、「所有と自由（ライブラリ）」を取るか**。Better Auth は後者に属しつつ、SaaS 並みの機能網羅と型安全性で「自前ホストの不便さ」を埋めにいくプロダクトだと位置づけられる。

---

## ニュース — Auth.js（旧 NextAuth）が Better Auth に合流

2025 年、認証ライブラリ界に大きな動きがあった。**Auth.js（旧 NextAuth.js）が Better Auth に合流（join）した**というアナウンスである。

Better Auth 公式ブログ「Auth.js is now part of Better Auth」では、Auth.js のコアメンテナ陣（lead maintainer の Balázs Orbán、Thang Vu、Nico Domino、Lluis Agusti、Falco Winkler）への謝辞とともに、両プロジェクトが一つになってエコシステムを前進させる旨が語られている。

> Better Auth beginning was inspired by Auth.js, and now, together, the two projects can carry the ecosystem further. The end goal remains unchanged: you should own your auth!

（Better Auth はそもそも Auth.js に着想を得て始まった。いま両者が一つになり、ゴールは変わらず「自分の認証は自分で所有すべき（you should own your auth）」だ、という主旨。）

この文脈で重要なのが **公式移行ガイド**の存在だ。Better Auth は、主要な認証サービス／ライブラリからの移行手順を公式ドキュメントとして提供している（いずれも実在する）。

- **Auth0 → Better Auth**
- **Clerk → Better Auth**
- **Auth.js（next-auth）→ Better Auth**
- **Supabase Auth → Better Auth**
- **WorkOS → Better Auth**

Auth.js からの移行ガイド冒頭は、過度な煽りをせず誠実な姿勢を示している。

> Since these projects have different design philosophies, the migration requires careful planning and work. If your current setup is working well, there's no urgent need to migrate. We continue to handle security patches and critical issues for Auth.js.

（設計思想が異なるため移行には計画と作業が要る。いまの構成が問題なく動いているなら急いで移行する必要はない。Auth.js のセキュリティパッチと重大問題の対応は継続する、という内容。）

つまり「NextAuth はもう終わり」という話ではなく、**新規プロジェクトの推奨先が Better Auth に移り、既存ユーザーには地続きの移行パスが用意された**、というのが実態である。実際、ある独立系の比較記事も「Auth.js v5 は既存コードベースの移行時にのみ妥当で、そのメンテナ自身が新規プロジェクトには Better Auth を勧めている」と要約している。

---

## 比較表 — Better Auth と主要プロダクト

下表は 2026 年 6 月時点での、各プロダクトの大まかな性格づけ（snapshot）。記号は `◎`=非常に強い / `○`=対応十分 / `△`=限定的 / `—`=該当なし。料金・機能は各社の変更が早いため、最終確認は一次情報で行うこと。

| プロダクト | 形態 | データ所有 | 型安全(TS) | 機能網羅 | UI提供 | 料金 | AI/エージェント対応 | エンプラ実績 |
|---|---|---|---|---|---|---|---|---|
| Better Auth | 自前ホスト型ライブラリ(OSS/MIT) | 完全(自分のDB) | ◎ 設計から型推論 | ◎ 2FA/passkey/SSO/organization等をplugin | なし(ヘッドレス、UIは自作/コミュニティ) | 無料(OSS) | ◎ Agent Auth plugin等で対応を明示 | 新興・2026年も機能拡張中 |
| Clerk | ホスト型SaaS | ベンダー側 | ○ SDK経由 | ○〜◎ | ◎ プリビルトUI/コンポーネント | MAU従量(無料枠あり) | △ 部分的 | あり |
| Kinde | ホスト型SaaS | ベンダー側 | ○ SDK経由 | ○ | ◎ ホスト型ログインUI | MAU従量(無料枠あり) | △ 限定的 | 中堅 |
| Auth0 | ホスト型SaaS(Okta傘下) | ベンダー側 | ○ SDK経由 | ◎ | ◎ Universal Login | MAU従量(規模拡大で高額化) | △ 限定的 | 豊富(事実上の業界標準) |
| Auth.js (NextAuth) | 自前ホスト型ライブラリ(OSS) | 完全 | △〜○ | △ コア中心で薄め | 最小限 | 無料 | — | 実績あり・新規はBetter Auth推奨 |
| Lucia | (旧)ライブラリ→現在は学習リソース | 完全 | ○ | 最小(自前実装が前提) | なし | 無料 | — | — (v3は2025/3に非推奨化) |
| Supabase Auth | BaaS付属(GoTrue/セルフホスト可) | 自Supabase内(セルフホスト可) | ○ SDK経由 | ○ | ○ Auth UIコンポーネント | Supabase従量(無料枠あり) | △ 限定的 | 成長中 |

補足:

- **Better Auth** は「ヘッドレス」設計で UI を同梱しない。ログイン画面などは自作するか、コミュニティ製の UI を組み合わせる。型安全・機能網羅・データ所有が強み。
- **Auth.js（NextAuth）** は OSS・データ所有という点で Better Auth と同じ流派だが、機能はコアに寄っており拡張は薄め。上記の通り合流の流れにある。
- **Lucia** は v3 が 2025 年 3 月に非推奨化され、現在は「DB とフレームワークで認証を自前実装するための **学習リソース**」へと方針転換した。ライブラリとして新規採用する対象ではない。
- **Supabase Auth** は BaaS（Supabase）に付属する認証（GoTrue ベース）。Supabase を使うなら統合が楽で、セルフホストの選択肢もある。
- 独立系の比較記事による意思決定の目安: 「データを自社インフラに置く必要があり、かつ認証インフラを運用できるなら **Better Auth**。50K MAU 未満の B2C で本番投入の速さ最優先なら **Clerk**。エンタープライズ SSO が要件なら **WorkOS**」。
- 表の「新興・エンプラ実績」「機能拡張中（=破壊的変更の可能性）」は裏を返せばコストでもある。トレードオフの詳細は（→ [§08 デメリット・注意点](08-cons.html)）で正直に扱う。

---

## まとめ

- **Better Auth** = TypeScript 製・OSS（MIT）の **自前ホスト型** 認証フレームワーク。`betterAuth({...})` だけでコアが立ち上がり、データは自分の DB に残る。
- 認証には **ホスト型 SaaS** と **自前ホスト型ライブラリ** の2流派があり、トレードオフは「速さ／無手間」対「所有／自由／運用責任」。
- 2025 年に **Auth.js が Better Auth へ合流**。公式移行ガイドが Auth0 / Clerk / Auth.js / Supabase Auth / WorkOS から提供され、自前ホスト陣営の事実上の標準になりつつある。
- 比較では、Better Auth は **型安全・機能網羅・データ所有** で抜けつつ、UI 同梱なし（ヘッドレス）と運用責任が自分持ちという点が SaaS との分かれ目になる。

---

## 一次情報 URL

- Better Auth 公式 Introduction — <https://www.better-auth.com/docs/introduction>
- Better Auth 公式 Comparison — <https://www.better-auth.com/docs/comparison>
- Auth.js（next-auth）からの移行ガイド — <https://www.better-auth.com/docs/guides/next-auth-migration-guide>
- Auth0 からの移行ガイド — <https://www.better-auth.com/docs/guides/auth0-migration-guide>
- Clerk からの移行ガイド — <https://www.better-auth.com/docs/guides/clerk-migration-guide>
- Supabase Auth からの移行ガイド — <https://www.better-auth.com/docs/guides/supabase-migration-guide>
- WorkOS からの移行ガイド — <https://www.better-auth.com/docs/guides/workos-migration-guide>
- ブログ「Auth.js is now part of Better Auth」 — <https://www.better-auth.com/blog/authjs-joins-better-auth>
- Auth.js チーム側のアナウンス（GitHub Discussion） — <https://github.com/nextauthjs/next-auth/discussions/13252>
- Better Auth GitHub リポジトリ（MIT ライセンス） — <https://github.com/better-auth/better-auth>
- Lucia 非推奨化アナウンス（学習リソースへ転換） — <https://github.com/lucia-auth/lucia/discussions/1714>
- 参考: 独立系比較記事「Best auth library for Next.js (2026)」(LogRocket) — <https://blog.logrocket.com/best-auth-library-nextjs-2026/>
