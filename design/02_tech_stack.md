# 02. 技術スタックと選定理由

選定の軸: **(1) 学習効果（土台が見える。抽象で隠さない）** / **(2) モダンで実務に地続き** / **(3) 既存の `docs/conventions` と整合** / **(4) ローカルで完結・無料**。

## 一覧

| 層 | 採用 | 主な代替 | ひとことWHY |
|---|---|---|---|
| パッケージ管理 | **pnpm workspaces** | npm workspaces / Turborepo | 速い・厳密・monorepo 標準。Turborepo はまだ要らない |
| 言語 | **TypeScript (strict)** | — | 既存規約の前提。フロント〜API で型共有 |
| DB | **PostgreSQL**（Docker） | MySQL / SQLite | 実務で最頻。JSONB・CTE・window 関数まで学べる |
| DB クライアント / migration | **Drizzle ORM + drizzle-kit** | Prisma / Kysely / 生SQL | SQL に近い。生成される SQL が読める。migration も素直。Prisma との比較は `labs/prisma-compare/` で |
| API フレームワーク | **Hono**（Node アダプタ） | Fastify / Express / Nest | 薄い・標準 Web API 準拠・型が効く。中で何が起きるか見える |
| 入力バリデーション | **Zod** | valibot / yup | 既存規約が Zod 前提。境界で `unknown → parse` |
| API 型共有 | **@hono/zod-openapi または手書き共有パッケージ** | tRPC | まず素の HTTP を理解する。tRPC は「HTTP を隠す」ので後回し |
| 認証 | **自前**（Cookie セッション → JWT の順で学ぶ） | Auth.js / Lucia / Supabase | 下の層を隠さない。ハッシュ・Cookie 属性・失効を手で |
| パスワードハッシュ | **@node-rs/argon2 または bcrypt** | — | Argon2id 推奨。bcrypt でも可 |
| フロント | **React + Vite** | Next.js / Remix | まず React 単体を理解。SSR/RSC の複雑さを最初から背負わない |
| ルーティング | **React Router（data router モード）** | TanStack Router | 事実上の標準。loader/action で取得の型を学べる。**framework モードは使わない**（Remix 相当になり「React 単体を理解する」意図から外れる） |
| サーバ状態 | **TanStack Query** | SWR / 手書き | キャッシュ・再取得・楽観更新の定番を学ぶ |
| フォーム | **React Hook Form + Zod resolver** | Formik / 手書き | 既存 react.md が RHF+Zod 前提 |
| スタイル | **Tailwind CSS** | CSS Modules / vanilla-extract | クラスで完結。デザインに凝らない方針と相性 |
| UI プリミティブ | **Radix UI（必要なものだけ）** | shadcn/ui 一式 / MUI | モーダル・メニュー等のアクセシビリティだけ借りる |
| テスト（単体） | **Vitest** | Jest | 既存規約が Vitest。Vite と同じ変換 |
| テスト（E2E） | **Playwright** | Cypress | 既存規約が Playwright |
| DB テスト | **Testcontainers（Postgres）** | sqlite で代用 | 本物の Postgres でクエリを検証 |
| コンテナ | **Docker + Docker Compose** | Podman | 実務標準。`compose up` で全部立つ |
| CI | **GitHub Actions**（既存 `ci.yml` を改修） | — | すでにある |
| ランタイム | **Node.js（Active LTS）** | Bun / Deno | 既存規約の前提。実務で最頻 |

## 層ごとの補足

### DB: なぜ PostgreSQL + Drizzle か

- **Postgres**: 学習の「重み」がちょうどいい。SQLite は制約・型・並行制御が緩く、実務の勘所（トランザクション分離・ロック・インデックス設計）が身につきにくい。MySQL でもいいが、Postgres の方が窓関数・CTE・JSONB・`RETURNING` など「モダン SQL」を素直に学べて、実務シェアも高い。
- **Drizzle**: スキーマを TS で定義し、そこから型と migration SQL を生成する。**生成された SQL がそのまま読める**のが Prisma との最大の違い（Prisma は独自 DSL + 独自クエリエンジンで、SQL が隠れる）。クエリも `db.select().from(users).where(eq(users.id, id))` のように SQL の構造が保たれる。「ORM に何をさせているか」が分かる。
- あえて **生 SQL を書く回**も指示書に混ぜる（Drizzle の `sql` テンプレートや migration の手書き）。ORM の便利さと限界を両方触る。

### API: なぜ Hono か

- **薄さ**: Hono はルータ + ミドルウェア + Context だけ。リクエストが来てレスポンスを返すまでの流れが 1 画面で追える。Nest は DI・デコレータ・モジュールの抽象が厚く、初学では「フレームワークの学習」に時間を取られる。
- **標準準拠**: `Request`/`Response` は Web 標準そのもの。ここで身につく知識は Fetch API・Service Worker・エッジランタイムにそのまま効く。
- **型**: ルート定義から型が導出される。`@hono/zod-openapi` を使えばスキーマ → 型 → OpenAPI ドキュメントが一気通貫。
- Express でも学習はできるが、型が弱く、非同期エラーハンドリングに癖があり、エコシステムが古い。Fastify は良い選択肢だが Hono の方が標準準拠で、実務の「エッジ / サーバレス」文脈にも触れられる。

### 認証: なぜ自前か

- Auth.js / Lucia / Supabase Auth はどれも「ログインが動く」状態を最短で作れるが、**Cookie 属性・CSRF・セッション失効・パスワードハッシュのパラメータ・トークンの署名検証**といった土台を隠す。ここを手で組むのが今回の目的。
- 学習ステップ（[06_auth.md](06_auth.md) で詳述）:
  1. **ダミー認証**: 固定ユーザー・平文比較・メモリセッション。フロントの器と API 認可の形だけ先に通す。
  2. **DB ユーザー + ハッシュ**: `users` テーブル、Argon2id、ログイン API。
  3. **Cookie セッション**: `Set-Cookie` の `HttpOnly`/`SameSite`/`Secure`、セッションストア（DB or Redis）、失効。
  4. **JWT**: アクセストークン + リフレッシュ、署名検証、`Authorization: Bearer`。セッション方式との比較。
  5. **認可**: ロール（`admin`/`member`）、ミドルウェアでのガード、フロントでの出し分け。

### フロント: なぜ Next.js でなく React + Vite か

- Next.js（App Router）は Server Components・Server Actions・ルーティング規約・キャッシュ階層など**同時に学ぶことが多すぎる**。「React とは何か」がまだ body に入っていない段階では、フレームワークの魔法とReact 本体の区別がつかなくなる。
- Vite + React 単体なら「コンポーネント / props / state / effect / context」を素の形で理解できる。API との通信も自分で `fetch` を書くところから。
- ルーティング・データ取得・フォームは個別のライブラリ（React Router / TanStack Query / RHF）で学ぶ。**各関心が分離されている**ので、それぞれが何をしているか分かりやすい。
- Next.js は「React が分かった後」の 2 周目で触ればいい（[09_screen_catalog.md](09_screen_catalog.md) の発展課題に置く）。

### monorepo: なぜ pnpm workspaces か

- 既存のルート `package.json` は「ツール母艦」として既にあり、`apps/*` / `packages/*` を継承前提で設計されている（[docs/conventions/TOOLING.md](../docs/conventions/TOOLING.md)）。
- pnpm はハードリンクでディスク効率がよく、`workspace:*` プロトコルで内部パッケージ参照が明示的。npm workspaces より厳密（幽霊依存を防ぐ）。
- Turborepo / Nx はタスクグラフのキャッシュが売りだが、パッケージが数個の段階ではオーバーキル。`pnpm -r` で十分。必要になったら足す。

## バージョン方針

**この文書にバージョン番号を書かない。** 実バージョンの正は `package.json` + lockfile。設計書に書くと必ず腐る（実際、一度腐った）。

- **本線は常に最新安定版を採用し、追随し続ける**。メジャーアップグレードそのものを学習項目として扱う（[08_infra_ops.md](08_infra_ops.md) の依存更新）。
- **「古いバージョンを学ぶ」ことに学習価値はない。** 同じライブラリの旧版固有の作法（React の `forwardRef`、Tailwind v3 の JS config + postcss チェーン等）は、新版で消えたボイラープレートを余分に覚えるだけ。既存コードで遭遇したときに読めばよい。
- ただし **「低いレイヤから積む」ことには価値がある**。自前認証 / 素の HTTP / React + Vite / 生 SQL を混ぜる、は「古い」のではなく「下の層」であり、順序に意味がある。この 2 つを混同しない。
- Drizzle は **1.0 未満**でマイナー間に破壊的変更が入る。完全固定 + 更新時は changelog を読む。
- Zod は周辺（`@hookform/resolvers` / `drizzle-zod` / `@hono/zod-openapi`）の対応版と揃える必要がある。**着手時に 3 つとも確認**してからメジャーを決める。
- 迷ったら「GitHub star 数」でなく「その層で何を学べるか」で選ぶ。

## 隔離ラボ（`labs/`）

「別の選択肢との比較」は本線を汚さず `labs/` に隔離する（[03_architecture.md](03_architecture.md)）。本線 CI の対象外。

| ラボ | 目的 |
|---|---|
| `labs/prisma-compare/` | `packages/db` と**同じスキーマ**を Prisma で定義し、同じクエリを両方で書いて、生成 SQL（`prisma:query` ログ vs Drizzle）と DX を比較。結論を README に書く |
| `labs/traffic-gen/` | 自分の検知器を自分で叩く（[11_bot_detection.md](11_bot_detection.md)） |
| （将来） | Next.js 版 / tRPC 版 / Auth.js 版 / K8s デプロイ（[09_screen_catalog.md](09_screen_catalog.md) の「発展」） |

**Prisma を labs でやる理由**：本線に入れないのは `schema.prisma` という独自 DSL と `prisma.user.findMany()` という独自クエリ言語が SQL の形を保存しないから（目的と衝突する）。一方で求人での遭遇率が高く、**「両方使って比較できる」は実績になる**ので、1 回は触る。
