# 03. アーキテクチャ

## monorepo 構成

```
Portfolio_site/
├── apps/
│   ├── api/                  Hono API サーバ（Node アダプタ）
│   │   ├── src/
│   │   │   ├── index.ts          エントリ（サーバ起動）
│   │   │   ├── app.ts            Hono インスタンス組み立て（ルート合成）
│   │   │   ├── routes/           機能別ルータ（auth, users, items, ...）
│   │   │   ├── middleware/       認証ガード・ロガー・エラーハンドラ
│   │   │   ├── db/               drizzle クライアント初期化・クエリ関数
│   │   │   └── lib/              hash, jwt, config など
│   │   ├── test/                 Vitest（ユニット + Testcontainers）
│   │   ├── Dockerfile
│   │   └── tsconfig.json         extends ../../tsconfig.base.json
│   └── web/                  React + Vite フロント
│       ├── src/
│       │   ├── main.tsx          エントリ
│       │   ├── app/              ルータ定義・プロバイダ（Query, Auth）
│       │   ├── screens/          画面レジストリ + 各画面（後から足す）
│       │   ├── features/         機能単位（auth, dashboard, users, ...）
│       │   ├── components/       横断 UI（Button, Modal, Table, ...）
│       │   ├── lib/              api クライアント・hooks・utils
│       │   └── styles/           tailwind エントリ
│       ├── e2e/                  Playwright
│       ├── Dockerfile
│       └── tsconfig.json         extends base + DOM/jsx/Bundler 上書き
├── packages/
│   ├── db/                   スキーマ + migration（drizzle）の単一の正
│   │   ├── src/schema/           テーブル定義（*.ts）
│   │   ├── drizzle/              生成された migration SQL
│   │   ├── drizzle.config.ts
│   │   └── src/seed.ts           開発用シード
│   └── shared/               フロント↔API で共有する型・zod スキーマ
│       └── src/                  DTO（LoginRequest, UserDto, ...）
├── infra/
│   ├── compose.yaml             postgres + api + web + (adminer)
│   ├── postgres/                初期化スクリプト（拡張の有効化など）
│   └── README.md                ローカル手順
├── labs/                     隔離ラボ（本線に入れない比較・実験）
│   ├── prisma-compare/          同じスキーマを Prisma で書いて比較
│   └── traffic-gen/             自分の bot 検知器を自分で叩く
├── docs/conventions/            既存（スタック別の書き方の正）
├── design/                      本ディレクトリ
├── package.json                 ツール母艦（既存）
├── pnpm-workspace.yaml          apps/* packages/*
├── tsconfig.base.json / tsconfig.json   既存
└── .github/workflows/ci.yml     改修する
```

## レイヤと責務

```
┌──────────────────────────────────────────────┐
│ apps/web (React)                              │
│  screens/ ── features/ ── components/         │
│         └── lib/api (fetch + TanStack Query)  │
└───────────────┬──────────────────────────────┘
                │ HTTP (JSON) + Cookie/JWT
┌───────────────▼──────────────────────────────┐
│ apps/api (Hono)                              │
│  routes/ ── middleware/ ── db/ (query fns)   │
│         └── lib/ (hash, jwt, config)         │
└───────────────┬──────────────────────────────┘
                │ SQL (drizzle)
┌───────────────▼──────────────────────────────┐
│ PostgreSQL                                   │
│  packages/db/schema が唯一の正               │
└──────────────────────────────────────────────┘

packages/shared: web と api が両方 import する DTO/zod スキーマ
```

- **web は DB を知らない**。API の JSON だけを見る。
- **api は SQL を `db/` に閉じ込める**。ルータからは「クエリ関数」を呼ぶ（`findUserByEmail(email)` 等）。ルータに生 SQL を書かない。
- **packages/db がスキーマの単一の正**。api はここを import して型付きクエリを書く。migration もここで管理。
- **packages/shared は「境界の契約」**。リクエスト / レスポンスの形を zod で定義し、api は `parse` で検証、web は同じ型で組み立てる。**Node 専用のもの（argon2 等）は置かない**（web のバンドルに載るため）。
- **`labs/` は本線ではない**。`pnpm-workspace.yaml` の `packages:` に入れず、CI とルート `tsconfig.json` の `references` からも外す。壊れていても本線が緑なら OK という区画。「別の選択肢との比較」を置く場所であって、「古いバージョン」を置く場所ではない（[02_tech_stack.md](02_tech_stack.md)）。

## 内部パッケージの解決（決定事項）

`@app/shared` / `@app/db` を app からどう参照するか。**「TS ソースを直接参照」と「project references」を混ぜると `tsc -b` が壊れる**ので、どちらかに決める必要がある。

**採用: project references（build 済み `dist` + `.d.ts` を参照）。**

理由: 既存のツール母艦（`tsconfig.base.json` の `composite: true`、solution-style なルート `tsconfig.json`、`scripts/typecheck.mjs`）が既にこの前提で組まれている（[docs/conventions/TOOLING.md](../docs/conventions/TOOLING.md)）。加えて **「project references が何をしているか」自体が学ぶ価値のある土台知識**で、この学習台の目的に合う。

### 役割分担

| パッケージ | `composite` | ルート `references` | 出力 | typecheck |
|---|---|---|---|---|
| `packages/shared` | **true** | 登録する | `dist/` + `.d.ts` | `tsc -b` |
| `packages/db` | **true** | 登録する | `dist/` + `.d.ts` | `tsc -b` |
| `apps/api` | **true** | 登録する | `dist/` | `tsc -b` |
| `apps/web` | **false**（`noEmit: true`） | **登録しない** | Vite が出す | `tsc --noEmit` を個別に |

- **`composite: true` と `noEmit: true` は両立しない**。`apps/web` は誰からも参照されないので composite が不要 → ルートの `references` から外し、`pnpm --filter @app/web typecheck` で個別に型検査する。これは回避策ではなく**これが正しい構成**。
- `apps/api` / `apps/web` の各 `tsconfig.json` には、自分が使う package を `references` に書く。

### package.json の `exports`

**ソース（`./src/index.ts`）を指さない。** `dist` を指す:

```
// packages/shared/package.json
{
  "name": "@app/shared", "version": "0.0.0", "private": true, "type": "module",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "scripts": { "build": "tsc -b", "dev": "tsc -b --watch", "typecheck": "tsc -b" }
}
```

### 帰結（これを受け入れる）

- **package を変更したら build が要る**。開発中は `tsc -b --watch` を回す（各 package の `dev` スクリプト）。
- `apps/web` の Vite dev は `@app/shared` を node 解決で `dist/index.js` から読む。**shared が未 build だと web が起動しない**ので、`dist` が無いときのエラーメッセージを一度見ておく。
- この「build の待ち時間」が、後で **Turborepo が何を解決する道具なのか**を理解する動機になる（[02_tech_stack.md](02_tech_stack.md)「必要になったら足す」の具体的なトリガー）。

## データフロー例（ログイン）

1. web: フォーム送信 → `POST /api/auth/login` に `{ email, password }`（`shared` の `LoginRequest` 型）
2. api: `middleware` でロギング → `routes/auth.ts` が body を `LoginRequest.parse()` で検証
3. api: `db/users.ts` の `findUserByEmail(email)` → Argon2id で `verify(hash, password)`
4. api: OK なら セッション作成（`db/sessions.ts`）→ `Set-Cookie: sid=...; HttpOnly; SameSite=Lax`
5. api: `200 { user: UserDto }` を返す
6. web: TanStack Query のキャッシュに user を格納 → ルータが `/dashboard` へ遷移
7. 以降のリクエストは Cookie 自動送出 → `middleware/auth.ts` がセッション検証 → `c.set("user", user)`

## 環境

| 環境 | DB | API | web | 用途 |
|---|---|---|---|---|
| local (compose) | `infra/compose.yaml` の postgres | `apps/api` コンテナ or `pnpm --filter api dev` | `apps/web` の Vite dev server | 日常開発 |
| CI | Testcontainers で使い捨て postgres | vitest 内で起動 | Playwright + preview build | PR ゲート |
| （将来）staging | マネージド Postgres | コンテナ | 静的ホスティング | 2 周目の課題。今は作らない |

## 設定（環境変数）

- `.env`（gitignore）に集約。`.env.example` を新規に置く（旧 TrendScope 版は削除済み）。
- 主なキー: `DATABASE_URL` / `PORT` / `SESSION_SECRET` / `JWT_SECRET` / `NODE_ENV` / `WEB_ORIGIN`（CORS）。
- api は起動時に `lib/config.ts` で zod 検証（未設定なら即落とす）。**秘密はログに出さない**。

## ポート（ローカル既定）

| サービス | ポート |
|---|---|
| web (Vite) | 5173 |
| api (Hono) | 8787 |
| postgres | 5432 |
| adminer（任意の DB GUI） | 8080 |
