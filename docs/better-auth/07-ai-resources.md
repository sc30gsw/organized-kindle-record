# AI Resources — AI が認証を書く / AI が認証する

> 本資料の **山場**。Better Auth は「AI と一緒に書く」ことを前提に設計された認証ライブラリであり、さらに「AI が認証主体になる」時代にも最初に手を打っている。本章は **AI が認証を書く（開発体験）** と **AI が認証する（エージェント認証）** の2軸で、Better Auth がなぜ「AI ネイティブな認証基盤」と呼べるのかを仕様レベルまで掘り下げる。後半は **Agent Auth Protocol（v1.0-draft）** と **WorkOS auth.md** をフロー図つきで詳説する。
> 締めの整理: **`llms.txt` がドキュメントを、`auth.md` が認証フローを、Agent Auth Protocol がエージェントの身元を、それぞれ AI に読める/扱える形へ変換する。**

### 🎤 登壇メモ

- **つかみ**: 「認証を *書く* AI と、認証 *される* AI — その両方に最初に手を打ったのが Better Auth」。
- **強調（ここが山場）**: 軸②。エージェントを「誰かの identity の影」から固有の principal へ引き上げる話。版は **Agent Auth Protocol（v1.0-draft）**、auth.md の核は **ID-JAG**（IETF ドラフト `draft-ietf-oauth-identity-assertion-authz-grant`）、`agent-auth` は **Better Auth 公式プラグイン** — この3点は一次ソース確認済みなので事実として断言してよい。それ以外の細部（承認方式の網羅性など）は「資料参照」に留め、断定しすぎない。
- **10分なら**: 軸②のフロー詳細（ID-JAG シーケンス図など）は概念だけ口頭で伝え、ASCII 図は「詳しくは資料」に逃がす。代わりに軸① CLI の **スキーマ自動生成** を実演1枚に絞ると刺さる。

---

## 0. この章の主張（2軸で読む）

「AI と認証」と言うとき、向きが2つある。混同すると話がぼやけるので、最初に分けておく。

| 軸 | 問い | 主役 | Better Auth の答え |
|---|---|---|---|
| 軸① AI が認証を書く | AI に認証コードを実装させられるか | 開発者 + コーディングAI | CLI / ドキュメント MCP / Skills / llms.txt / Ask AI |
| 軸② AI が認証する | AI エージェント自身を認証できるか | AI エージェント | Agent Auth（公式プラグイン + プロトコル）/ auth.md |

> 一言で: **軸①は「実装の自動化」、軸②は「認証される主体の追加」。** クラウド認証 SaaS は軸①でブラックボックス化しがちで、軸②はまだこれから。Better Auth は **コードベース型 OSS** という性質を武器に、両軸を同時に押さえにいっている。

---

## 1. 軸①「AI が認証を書く」— AI ネイティブな開発体験

### 1.1 なぜ「コードベース型」だと AI と相性がいいのか

Better Auth は自分のサーバー・自分の DB で動く **ライブラリ**であり、認証ロジックもスキーマも **すべて自分のリポジトリ内のコードとして存在する**。これは AI コーディングにとって決定的に有利だ。

- **AI がコードを読める** — 設定（`auth.ts`）・スキーマ・呼び出し箇所がリポジトリ内にあるので、AI は実際の構成を読んで文脈に沿った実装ができる。
- **AI がスキーマを生成できる** — 設定からテーブル定義を機械的に導出できる（後述の CLI）。
- **AI が規約に沿える** — 公式が配布する Skills / ドキュメントを参照させれば、ライブラリの作法どおりに書かせられる。

> 主張: **クラウド認証 SaaS は管理画面とダッシュボードの「外」に実装の実体を持つため、AI に渡せる手掛かりが少ない。** Better Auth は逆で、認証が「AI に読ませ・書かせられるコード」として手元にある。これが AI ネイティブの本質。

Better Auth は公式に4つの AI 向けリソースを束ねて提供している（`/docs/ai-resources`）。

| リソース | 何か | いつ使うか |
|---|---|---|
| Ask AI in docs | ドキュメント内で AI に直接質問する UI | 仕様をその場で確認したいとき |
| llms.txt | ドキュメント全体を LLM 向けに構造化したテキスト | AI に文脈をまとめて渡したいとき |
| ドキュメント MCP サーバー | ドキュメント検索・例・セットアップ補助を MCP で提供 | エディタ/エージェントから最新ドキュメントを引きたいとき |
| Skills | 規約・安全なパターンを教えるエージェントスキル | AI に作法どおり実装させたいとき |

### 1.2 CLI — 人間がスキーマを手書きしない

Better Auth は **初期からビルトイン CLI を持つ**。これが「AI ネイティブ」を支える土台で、認証テーブルを人間が手で書かないための仕組みだ。

> 関連: 基本概念とスキーマ生成の全体像は [§01 コンセプト](01-concepts.html) を参照。

主要コマンド（`npx @better-auth/cli@latest <command>`）:

| コマンド | 役割 |
|---|---|
| `generate` | 設定とプラグインから DB スキーマ（ORM 定義 / SQL）を生成する |
| `migrate` | スキーマを DB に直接適用する（ビルトインの Kysely アダプタ向け） |
| `init` | プロジェクトに Better Auth を初期セットアップする |
| `secret` | アプリ用のシークレットキーを生成する |
| `info` | 環境・設定の診断情報を集める |

`generate` の出力先は使っている DB レイヤで変わる。

- **Prisma** → `prisma/schema.prisma` に書き出す。
- **Drizzle** → プロジェクトルートの `schema.ts` に書き出す。
- **Kysely** → `schema.sql` として書き出す。

主なフラグ:

- `--output` — 生成スキーマの保存先を指定する。
- `--config` — `auth.ts` の場所を指定する。デフォルトは `./`・`./utils`・`./lib`（および `src` 配下の同名ディレクトリ）を探索する。
- `--yes` — 確認プロンプトを飛ばして直接生成する。

最小の流れはこうなる。

```ts
// auth.ts — プラグインを足すだけ。テーブル定義は書かない
import { betterAuth } from "better-auth";
import { organization, twoFactor } from "better-auth/plugins";

export const auth = betterAuth({
  database: /* adapter */,
  emailAndPassword: { enabled: true },
  plugins: [organization(), twoFactor()],
});
```

```bash
# 設定とプラグインからスキーマを生成 → DB に適用
npx @better-auth/cli@latest generate
npx @better-auth/cli@latest migrate
```

> 肝: **プラグインを追加するたびに、必要なテーブル・カラムが自動で追従する。** `organization` を足せば組織/メンバー/招待のテーブルが、`twoFactor` を足せば 2FA 用のカラムが、`generate` の出力に現れる。人間（や AI）が認証スキーマを手書きする必要がない。Prisma/Drizzle 利用時は `generate` 後にそれぞれの migration ツールで適用する運用になる。

### 1.3 ドキュメント MCP サーバー — AI に「最新の正解」を引かせる

Better Auth は **リモート MCP サーバー** をホストしており、ドキュメント検索・コード例・セットアップ補助を、任意の MCP 対応クライアント（Cursor / Claude Code / Open Code ほか）に公開している。

- **エンドポイント**: `https://mcp.better-auth.com/mcp`
- これは認証機能としての [MCP プラグイン](https://www.better-auth.com/docs/plugins/mcp)（自前で MCP サーバーに OAuth を付けるもの）とは **別物**。こちらは「ドキュメントを引くための MCP」。

CLI から各クライアントへ一発で追加できる（フラグ無しなら対応ターゲット一覧を表示）。

```bash
npx auth@latest mcp --cursor       # Cursor に追加
npx auth@latest mcp --claude-code  # Claude Code に追加
npx auth@latest mcp --open-code    # Open Code に追加
npx auth@latest mcp               # フラグ無し → 対応ターゲットを一覧表示
```

> 補足: CLI 本体は `@better-auth/cli`。`npx auth@latest mcp --cursor` はその短縮エイリアス経由の呼び出しで、資料によっては `npx @better-auth/cli mcp --cursor` と表記される。狙いは同じ — **AI に古い記憶ではなく公式ドキュメントの最新を引かせる**こと。

### 1.4 公式 Skills — AI に「作法」を守らせる

[Agent skills](https://agentskills.io) は、コーディングエージェントにプロジェクトの規約・安全なパターン・「ドキュメントのどこを見るか」を教える、ポータブルな指示ファイル（例: `SKILL.md`）。Better Auth の **公式スキルパック**は [`better-auth/skills`](https://github.com/better-auth/skills) リポジトリにある。

`skills` CLI で導入する（`npx` 経由なのでグローバルインストール不要）。

```bash
npx skills add better-auth
```

> 効果: AI が「それっぽいが間違っている」認証コードを書く事故を減らせる。**規約をプロンプトに毎回書く代わりに、スキルとして固定し、エージェントに常時参照させる。** 認証はミスがそのまま脆弱性になる領域なので、この「型を強制する」仕組みの価値は大きい。

### 1.5 llms.txt — ドキュメントを丸ごと LLM に読ませる

Better Auth はドキュメント全体を LLM 向けの構造化テキストとして公開している。

- 索引: <https://www.better-auth.com/llms.txt>
- 各ページの素のテキストは `/llms.txt/docs/<path>.md` で取得できる（例: `/llms.txt/docs/ai-resources.md`）。

これにより、AI は HTML をスクレイピングせずに **ページ単位の Markdown を直接コンテキストへ流し込める**。「ドキュメントを AI が読める形で配る」という設計思想が、サイト構造そのものに組み込まれている。

### 1.6 Ask AI in docs

ドキュメントサイト上で **AI に直接質問できる** UI を備える。仕様の確認や「この設定はどう書くか」を、ページを横断して探さずにその場で解決できる。軸①の中では最も軽量な入口。

### 1.7 軸①のまとめ

- **CLI** がスキーマ生成を自動化し、**MCP / llms.txt** が AI に最新ドキュメントを供給し、**Skills** が実装の作法を矯正し、**Ask AI** がその場の疑問を埋める。
- これらは互いに補完的で、合わせると「**AI が、正しい文脈で、規約どおりに、認証コードを書ける**」状態が作れる。
- 繰り返すが、これが成り立つ前提は **認証がコードとして手元にあること**。コードベース型 OSS の強みが、そのまま AI ネイティブの強みになっている。

---

## 2. 軸②「AI が認証する」— エージェント認証の最前線

ここからは向きが変わる。**「AI エージェント自身を、どう認証するか」** という、まさに今立ち上がりつつある領域。Better Auth はここでも先手を打っている。ここを仕様レベルまで掘る。

### 2.1 出発点: 既存の認証は「人間 + 静的アプリ」しか想定していない

Agent Auth の問題提起は鋭い。

> Web 向けに作られてきた認証モデル（OAuth・セッション・API キー）は、すべて **2種類のアクター**を前提にしている — **人間のユーザー**と、**事前定義されたスコープを持つ静的なアプリ**。エージェントはそのどちらでもない。

エージェントは、

- **一度きりの短命タスク**から、**常駐のバックグラウンドワーカー**、**多段の自律システム**まで幅がある。
- **人間が常時介在しないまま**外部サービスを呼ぶ。
- **ユーザーの代理**で動くこともあれば、**完全に自分の判断**で動くこともある。

つまり、エージェントは「人間でも静的アプリでもない第3のアクター」であり、既存の認証モデルにそのまま当てはまらない。ここが軸②の根本。

### 2.2 問題: Delegated agents（継承された identity）

エージェントがユーザーの代理で動くとき、従来は **アプリかユーザーの identity をそのまま継承**してしまう。既存の資格情報の下で動くため、エージェントを独立した principal（主体）として識別できない。エージェントが「誰か別人の identity に溶け込んで」しまうのだ。これが3つの欠落を生む。

- **可視性なし（No visibility）** — サーバーは、どのエージェントがリクエストしたのか判別できない。
- **スコープなし（No scoping）** — エージェントごとに権限を絞れない。資格情報を共有する全エージェントが同じ権限を持つ。
- **分離なし（No isolation）** — 1つのエージェントだけを失効できない。止めるなら全部を止めるしかない。

> つまり「ユーザーの鍵をそのままエージェントに渡している」状態。監査もできず、最小権限も効かず、事故時の封じ込めもできない。エージェントが本格的に外部サービスを操作し始めると、これは致命的になる。

---

### 2.3 Agent Auth Protocol（v1.0-draft）

**Agent Auth** は、AI エージェントの認証・**capability ベースの認可**・サービス発見のための **オープンソース標準 + 実装**。サイト上の表記は **v1.0-draft**（仕様策定途上）。

#### 2.3.1 何を与えるか — 独立した principal 化

アプリやユーザーの identity を継承する代わりに、**各エージェントが固有の以下4点を持つ**。

| 要素 | 内容 |
|---|---|
| identity | エージェント固有の身元。どのエージェントかをサーバーが識別できる |
| 暗号鍵ペア | エージェント自身の鍵。リクエストへの署名に使う |
| scoped capabilities | 付与された範囲の権限（能力）。最小権限で絞れる |
| 独立したライフサイクル | そのエージェントだけを発行・更新・失効できる |

これにより 2.2 の3欠落が、それぞれ次のように解消される。

| 従来（Delegated）の欠落 | Agent Auth による解消 |
|---|---|
| 可視性なし | 固有 identity で「どのエージェントか」を明確に帰属（clear attribution） |
| スコープなし | エージェントごとに capability を付与（scoped permissions / least privilege） |
| 分離なし | 独立したライフサイクルで、そのエージェントだけを失効できる |

結果として、Claude / ChatGPT / Cursor のような AI アプリが、外部サービス（銀行・API・デプロイパイプライン・コミュニケーションツール）へ接続し、**clear attribution（誰がやったか明確）+ scoped permissions（最小権限）** でタスクを実行できる。

#### 2.3.2 仕様がカバーする範囲

フル仕様（`/specification`）は次を定義する。

- **identity** — エージェントの身元
- **registration** — サーバーへの登録
- **authentication** — 認証
- **capabilities** — 能力（スコープ付き権限）
- **approval** — ユーザー承認
- **discovery** — サービス/プロバイダの発見
- **lifecycle** — 発行から失効までのライフサイクル

概念は3つの役割に整理される。

- **Servers** — 認可と capability 管理を行う側
- **Client** — エージェントとサーバーをつなぐブリッジ
- **Agents** — 実行時の AI アクター本体

#### 2.3.3 フロー: discovery → registration → capability authorization

Better Auth の `agent-auth` プラグインが実装する標準フローは次の5段階。ユーザー承認は **`device_authorization`（ユーザーコードによるブラウザ承認）** か **`ciba`（バックチャネル承認）** で行う。

```text
[Agent]                              [Server / Provider]            [User]
  |  1. GET /.well-known/agent-configuration  ───────▶                |
  |     ◀── 提供している capabilities 一覧                             |
  |                                                                    |
  |  2. capabilities を見て「何が必要か」を判断                        |
  |                                                                    |
  |  3. register + capability grant をリクエスト ───▶                  |
  |                                                                    |
  |  4. 承認要求 (device_authorization / CIBA) ───────────────────▶  承認
  |     ◀── capability grant 発行 ◀───────────────────────────────  |
  |                                                                    |
  |  5. 短命JWT(aud=呼び先URL)に署名し、付与された capability を       |
  |     default_location（または capability 個別の location）で実行 ─▶ |
```

> 発見ルートは **`/.well-known/agent-configuration`** に置く（Better Auth の base path が `/api/auth` でも、発見ルートはここ）。各 capability は共通の **`default_location`** か、capability 固有の **`location`** で呼び出す。

#### 2.3.4 従来手法との違い（比較表）

Agent Auth は OAuth の置き換えではない。**エージェントの identity・登録・capability・発見に特化した単一プロトコル**。

| 観点 | OAuth | API キー | Delegated（継承） | Agent Auth |
|---|---|---|---|---|
| 主目的 | ユーザーが3rdパーティアプリに権限委譲 | アプリ単位の静的認証 | ユーザー/アプリの身元を流用 | エージェント固有の身元・認可・発見 |
| エージェント識別 | 不可（アプリ単位） | 不可（キー単位） | 不可（誰かに溶け込む） | 可（principal ごと） |
| 権限の粒度 | 事前定義スコープ | キーに紐づく固定 | 共有 = 同一権限 | capability で個別付与 |
| 個別失効 | 困難 | キー失効で全停止 | 不可 | 可（独立ライフサイクル） |
| ライフサイクル概念 | 弱い | なし | なし | あり（仕様の一部） |

> 公式 FAQ: **「OAuth の置き換えか?」→ No。** OAuth は「ユーザーが3rdパーティアプリにリソースアクセスを許可する」別問題を解く。Agent Auth だけを使うなら OAuth サーバーは不要だが、サーバーは「ユーザーがアプリを認可する」ために OAuth を併存させてもよい。

#### 2.3.5 MCP との関係

> 公式 FAQ: **「MCP の auth を使えばいい?」→ No。** MCP は OAuth 2.1 を使うが、**per-agent identity・capability ベース認可・エージェントのライフサイクルという概念を持たない**。3つのエージェントが同じ MCP サーバーを OAuth 経由で使うと、サーバーには **3つのエージェントではなく1つのクライアント**にしか見えない。

棲み分けは明快。**Agent Auth は MCP と併存できる** — サービスは capability を MCP ツールとして公開しつつ、**identity と認可のレイヤだけ Agent Auth に任せる**。MCP（ツール提供）と Agent Auth（誰が・何を許されているか）は層が違う。

#### 2.3.6 エコシステムと立ち位置

- **仕様/実装の保守は Better Auth チーム**。ただし **Better Auth には依存しない**。実装・利用に Better Auth は不要で、任意のプラットフォーム/プロバイダが独立に採用できるオープン標準。
- **SDK** — 公式実装あり（`/docs/sdks`）。
- **Directory** — 対応サーバーを登録・一覧できる（<https://agent-auth.directory>）。
- **Community** — Discord コミュニティあり。
- **Demo** — 動作デモあり（`/demo`）。
- ソース: <https://agentauthprotocol.com/> / GitHub `better-auth/agent-auth-protocol`。

#### 2.3.7 Better Auth の `agent-auth` プラグインが実装するもの

プロトコルは Better Auth 非依存だが、**Better Auth 側には `agent-auth` 公式プラグインとして既に組み込まれている**。プラグインの守備範囲は「**エージェントの identity・registration・discovery・capability ベース認可**」。

> 関連: プラグイン体系の全体像は [§03 プラグイン大全](03-plugins.html) を参照。

- **発見ルート** `/.well-known/agent-configuration` を生やす。
- **capability** を定義し、共通 `default_location` または個別 `location` で実行させる。
- 承認方式として **`device_authorization`** と **`ciba`** をサポート。
- エージェントは **短命 JWT（`aud` が呼び先 URL に一致）** に署名して各 capability を呼ぶ。

発見ルートの実装はこのくらい薄い（Next.js の例）。

```ts
// app/.well-known/agent-configuration/route.ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  // プラグインが組み立てた agent-configuration を返すだけ
  const config = await auth.api.getAgentConfiguration();
  return NextResponse.json(config);
}
```

> ここで2軸が交差する: **「AI が認証を書く（軸①の CLI/プラグイン体験）」仕組みの上に、「AI が認証される（軸②の Agent Auth）」機能が、ひとつのプラグインとして乗る。** 同じライブラリ・同じワークフローで両方扱える点が Better Auth の構造的な強み。

---

### 2.4 auth.md（WorkOS）— ドメインに置く1枚の Markdown

軸②のもう一つの潮流が、WorkOS が提案する **auth.md**。狙いは **「サインアップフォーム（人間の UI）なしで、エージェントがユーザーを登録する」** こと。GitHub の `workos/auth.md` は、これを **agentic registration（エージェントによる登録）の参照実装**と位置づけている。

#### 2.4.1 ファイルの構造と置き場所

auth.md は、アプリが自分のドメインに置く **小さな Markdown ファイル1枚**（典型的には `https://service.example.com/auth.md`）。記述するのは次の4点。

- そのサービスが **どの登録フローに対応しているか**
- 公開する **スコープ（権限）**
- **どう登録するか**の手順
- **登録後に何をするか**

肝は **Markdown がプレーンテキストである**こと。同じ1ファイルが、

- **人間の統合担当者向けドキュメント**であると同時に、
- **エージェントが実行時に発見して読めるランタイム成果物（discoverable runtime artifact）**にもなる。

> 発想の転換: **「サインアップフォーム（人間の UI）」を用意する代わりに、「エージェントが読める登録の契約書」をドメインに置く。** 認証フローが、画面ではなく機械可読なテキストとして公開される。

代表的な auth.md の形（illustrative。実フィールド名はサービス/仕様により異なる）:

```md
# auth.md — Notes App

エージェントがユーザーの代理で登録するための手順を記述する。

## Supported flows
- agent-verified   # エージェントの IdP が保証する
- user-claimed     # ユーザーがコードで確認する

## Scopes
- notes:read   ノートの閲覧
- notes:write  ノートの作成・編集

## Registration
- discovery:        https://notes.example.com/.well-known/oauth-authorization-server
- identity endpoint: POST /agent/identity
- token endpoint:    POST /oauth2/token  (grant_type=jwt-bearer)

## After registration
- 発行された access_token を Authorization: Bearer で各 API に付与する
- トークンは短命・失効可能。失効イベントを受けたら再登録する
```

#### 2.4.2 3つの役割と ID-JAG

auth.md は3つの役割で動く。

| 役割 | 担当 |
|---|---|
| Agent | ユーザーの代理で動くエージェント |
| Agent Provider（IdP） | identity assertion（**ID-JAG**）を発行するエージェントの身元プロバイダ |
| Service | その assertion を受理し、scoped なアクセスを発行するサービス |

**ID-JAG** = Identity Assertion JWT Authorization Grant。IETF の OAuth ドラフト（`draft-ietf-oauth-identity-assertion-authz-grant`）に基づく、身元アサーションを認可グラントとして使う仕組み。

#### 2.4.3 Agent verified flow（エージェント検証フロー）

エージェントの IdP がユーザーを保証する **agent-attested** なフロー。人間がループに入らない。**このフローだけはエージェント側の統合実装が必要**。ID-JAG を使った流れは次のとおり（`workos/auth.md` のシーケンス図を ASCII 化）。

```text
User      Agent                         Service                        Provider(IdP)
  |   1. GET /api/resource ───────────────▶ |                               |
  |      ◀── 401 WWW-Authenticate:                                          |
  |          Bearer resource_metadata="..." |                               |
  |   2. GET /.well-known/oauth-protected-resource ─▶                       |
  |      ◀── 200 PRM (authorization_servers)|                               |
  |   3. GET /.well-known/oauth-authorization-server ─▶                     |
  |      ◀── 200 AS metadata (agent_auth ブロック)                          |
  | ◀─ 4. 「この audience に identity を主張してよい?」(consent)             |
  | ─▶    consent granted                   |                               |
  |   5. audience 固有の ID-JAG を要求 ───────────────────────────────────▶ |
  |      ◀── 200 ID-JAG ◀──────────────────────────────────────────────── |
  |   6. POST /agent/identity                |                              |
  |      { type: identity_assertion, assertion: ID-JAG } ─▶                 |
  |          7. Service ─▶ Provider: GET /.well-known/jwks.json             |
  |             ◀── 200 JWKS（署名検証）                                    |
  |      ◀── 200 identity_assertion          |                              |
  |   8. POST /oauth2/token                  |                              |
  |      grant_type=jwt-bearer&assertion=... ─▶                             |
  |      ◀── 200 access_token (scoped / short-lived / revocable)           |
```

要点:

- サービスは標準の **`.well-known/oauth-protected-resource` / `.well-known/oauth-authorization-server`** で発見可能。後者に **`agent_auth` ブロック**を載せる。
- サービスは **Provider の JWKS** を取りに行き、ID-JAG の署名を検証する。
- 最後は **`grant_type=jwt-bearer`** で access_token に交換する。既存の OAuth トークンエンドポイントを再利用できる。

#### 2.4.4 User claimed flow（ユーザー確認フロー）

IdP（プロバイダ）が不要なフロー。**エージェントがユーザーにコードを見せ、ユーザーがアプリにサインインして確認（claim）する**。アプリが auth.md に書いた情報だけで、**エージェントが自分で発見・自己ナビゲートできる**よう設計されている（=エージェント側の特別な統合が不要）。手順の骨子:

1. エージェントが `auth.md` を取得し、user-claimed フローを選ぶ。
2. エージェントがサービスに登録を要求し、**確認コード**を受け取る。
3. エージェントがユーザーに **コード + サインイン URL** を提示する。
4. ユーザーがアプリにサインインし、そのコードを **claim（確認）** する。
5. 確認が取れたら、エージェントが **scoped access_token に交換**する。
6. 以降はトークンで API を呼び、**失効（revoke）を受けたら再登録**する。

#### 2.4.5 エージェントはどう発見・解析・実行するか

`workos/auth.md` リポジトリは、**エージェントが読む手続きマニフェスト**として `AUTH.md`（skill manifest）を置いている。その手続きレシピはこの6段階。

```text
discover → register → claim → exchange → use → handle revoke
（発見）   （登録）    （確認）  （トークン交換） （利用） （失効対応）
```

- **discover** — ドメインの `auth.md` と `.well-known/...` を取得して、対応フロー・スコープ・エンドポイントを把握する。
- **register / claim** — 選んだフロー（verified or claimed）で登録・確認する。
- **exchange** — assertion / 確認結果を **scoped access_token** に交換する。
- **use** — トークンを Bearer で付けて API を呼ぶ。
- **handle revoke** — 失効を受け取ったら停止/再登録する。

#### 2.4.6 信頼 / セキュリティモデル

- 発行される資格情報は、**ユーザーに紐づく scoped access token**。**短命かつ失効可能**で、**標準の OAuth** で発行される（既存の API 認証をそのまま再利用できる）。
- verified フローでは、サービスが **Provider の JWKS で ID-JAG の署名を検証**する。アサーションは **audience（audience 固有）** に紐づくため、別サービスへ使い回せない。
- **ユーザー consent** が明示的に挟まる（「この audience に identity を主張してよいか」）。
- Provider は **失効イベント（revocation events）** を送れる。アプリ/エージェントはそれに従う。
- **アプリがどのフローを受け付けるかを決める**。verified だけ、claimed だけ、両対応、いずれも選べる。発行する資格情報も含めてアプリ側が主導権を持つ。

#### 2.4.7 `github.com/workos/auth.md` の位置づけ

仕様本体 + **参照実装**。リポジトリ構成（Layout）は次のとおり。

```text
.
├── AUTH.md            ← エージェントが読む skill manifest（手続きレシピ）
├── agent-services/    ← サンプルの resource server + authorization server
├── agent-providers/   ← ID-JAG を発行するサンプル agent IdP
└── shared/            ← 共有ワークスペースパッケージ（ports, types）
```

読み手別の入口も用意されている。

- **エージェント実装者 / テンプレートが欲しい人** → `AUTH.md`（discover → register → claim → exchange → use → handle revoke の手続きレシピ）
- **サービス実装者** → `agent-services/README.md`（実装ガイド・シーケンス図・エラー表）
- **IdP 実装者** → `agent-providers/README.md`（ID-JAG の発行、JWKS の公開、失効イベントの送信）

auth.md は WorkOS 製だが **仕様はオープン**。整備の方向は「**apps 向け**（登録を有効化する）」「**agent providers 向け**（検証済み identity を付与する）」の2系統のガイドに分かれている。

---

### 2.5 Agent Auth と auth.md の関係（棲み分け）

両者は競合というより、層が違う。

| 観点 | Agent Auth（Better Auth/AAP） | auth.md（WorkOS） |
|---|---|---|
| 主な問い | エージェントに固有 identity をどう与えるか | エージェントにどう登録/発見させるか |
| 焦点 | identity・capability・lifecycle | registration（サインアップ無しの登録） |
| 形 | プロトコル + SDK + 公式プラグイン | ドメインに置く1枚の Markdown + 参照実装 |
| 発見ルート | `/.well-known/agent-configuration` | `auth.md` + `/.well-known/oauth-*` |
| 著者/保守 | Better Auth チーム | WorkOS |
| 開放性 | オープン（Better Auth 非依存） | オープン（WorkOS 著） |
| 資格情報 | 暗号鍵ペア + scoped capabilities | OAuth の scoped・短命・失効可能トークン |
| 共通言語 | OAuth/JWT 系の標準に乗る | OAuth/JWT 系の標準に乗る（ID-JAG, JWKS, jwt-bearer） |

> どちらも共通して目指すのは、**エージェントを「誰かの identity の影」から、固有 identity を持つ独立した主体へ引き上げる**こと。アプローチは違えど方向は同じで、いずれも既存の OAuth/JWT/`.well-known` 標準の上に乗っているのが現実的な点。

---

## 3. まとめ — 認証は「人間の UI」から「機械が読む契約」へ

- **軸①（AI が認証を書く）**: CLI のスキーマ自動生成、ドキュメント MCP、公式 Skills、llms.txt、Ask AI。**コードベース型だからこそ、AI がコードを読み・スキーマを生成し・規約に沿って実装できる。** クラウド SaaS のブラックボックスには出しにくい強み。
- **軸②（AI が認証する）**: Agent Auth がエージェントに固有 identity と capability を与え、auth.md が登録フローを機械可読化する。**Better Auth はこの両輪を、同じライブラリ・同じワークフローの中に持つ。**
- 三題噺でまとめる:

| 何を | 何が | AI にとって |
|---|---|---|
| ドキュメント | `llms.txt` | 読める構造化テキストになる |
| 認証フロー | `auth.md` | 発見・実行できるランタイム成果物になる |
| エージェントの身元 | Agent Auth Protocol | 識別・認可・失効できる principal になる |

> 着地: **AI が認証し、AI が認証を書く。** 認証は「人間が操作する UI」から「**機械が読む契約（machine-readable contract）**」へと拡張されつつある。その最前線を、コードベース型 OSS という土台の上で同時に押さえているのが Better Auth。これが本資料で最も伝えたい一点。

---

## 付録: 一次情報リンク

- Better Auth / AI Resources: <https://www.better-auth.com/docs/ai-resources>
- Better Auth / ドキュメント MCP: <https://www.better-auth.com/docs/ai-resources/mcp>
- Better Auth / Skills: <https://www.better-auth.com/docs/ai-resources/skills>
- Better Auth / CLI: <https://www.better-auth.com/docs/concepts/cli>
- Better Auth / agent-auth プラグイン: <https://www.better-auth.com/docs/plugins/agent-auth>
- Better Auth / llms.txt: <https://www.better-auth.com/llms.txt>
- Agent Auth Protocol（v1.0-draft）: <https://agentauthprotocol.com/>
- Agent Auth Protocol / Introduction: <https://agentauthprotocol.com/docs/introduction>
- Agent Auth Protocol / Specification: <https://agentauthprotocol.com/specification>
- Agent Auth Directory: <https://agent-auth.directory>
- WorkOS auth.md: <https://workos.com/auth-md>
- WorkOS auth.md / Docs: <https://workos.com/auth-md/docs>
- auth.md 仕様/参照実装（GitHub）: <https://github.com/workos/auth.md>
- ID-JAG（IETF draft）: <https://datatracker.ietf.org/doc/draft-ietf-oauth-identity-assertion-authz-grant/>
