# Sprint 1 全体マップ — 土台の縦切りを 1 本通す

> テーマ: `docker compose up` → DB migration → API 起動 → ログイン → ダッシュボードのシェル表示。この 1 本を貫通させる。
> 期間: **7 回**（1 回 2〜4 時間想定）。**カレンダーの日ではなく「回」で数える** —— 遅れを心理的な負債にしないため。詰まったら 1 回を 2 回に割ってよい。
> 想定: BE ほぼ未知 / React 未経験（[01_goals_and_scope.md](01_goals_and_scope.md)）。**見積より伸びるのが普通**。
> 完了時の状態:
> - `pnpm install` → `docker compose -f infra/compose.yaml up -d` → `pnpm --filter db migrate` → `pnpm --filter api dev` → `pnpm --filter web dev` で全部立つ
> - ブラウザで `/login` → admin でログイン → `/dashboard` にシェル（サイドバー + ヘッダ + 空の Outlet）が出る
> - `/catalog` に画面レジストリの一覧が出る（中身は dashboard 1 件だけでよい）
> - CI が `lint` / `typecheck` / `test-api` / `test-web` で緑
> - **E2E（Playwright）は Sprint 1 に含めない** —— 器が固まる前に書くと書き直しになるため、Sprint 2 の頭で入れる
> 主に踏む層: `[INFRA]`(1-2) → `[BE]`(3-4) → `[FE]`(5-7) の順で 1 周する

## 全体マップ

| 日 | テーマ | 指示書 | 主成果物 |
|---|---|---|---|
| Day 1 | monorepo 化と足場 | [sprint1/day1.md](sprint1/day1.md) | pnpm workspace / `apps/{api,web}` `packages/{db,shared}` の空パッケージ / `CLAUDE.md` 刷新 / CI 改修 |
| Day 2 | DB とスキーマ | [sprint1/day2.md](sprint1/day2.md) | `infra/compose.yaml`（postgres）/ `packages/db` に Drizzle + `users`/`sessions` スキーマ + migration + seed |
| Day 3 | API の骨格 | [sprint1/day3.md](sprint1/day3.md) | Hono アプリ / `GET /health` / エラー・ロガー・CORS ミドルウェア / `packages/shared` に DTO / api の Vitest |
| Day 4 | 認証と認可 | [sprint1/day4.md](sprint1/day4.md) | `POST /auth/login` `/logout` `GET /auth/me`（DB ユーザー + Argon2 + **署名付き** Cookie セッション）/ 認可ミドルウェア / テスト |
| Day 5 | フロント立ち上げ | [sprint1/day5.md](sprint1/day5.md) | React + Vite + Tailwind v4 / `Field` / **素の React で静的なログイン画面**（API 未接続） |
| Day 6 | API と繋ぐ | [sprint1/day6.md](sprint1/day6.md) | `lib/api/client.ts` + `ApiError` / TanStack Query / `AuthProvider` / RHF + zod で**実ログイン** / web の単体テスト |
| Day 7 | 器を組む | [sprint1/day7.md](sprint1/day7.md) | React Router data router / `requireAuth` loader / `DashboardShell` / `screens/registry.ts` / `/catalog` |

## 各日の概要

### Day 1（[INFRA] [設計]）
- D1-1 前提確認：Node(Active LTS) / pnpm / Docker の存在確認、ブランチ確認、バージョン確定(特に Zod の周辺対応) **[自分]**
- D1-2 pnpm workspace 化：`pnpm-workspace.yaml`、ルート `package.json` を pnpm 前提に、`.npmrc` **[自分]**
- D1-3 空パッケージ 4 つ：`apps/api` `apps/web` `packages/db` `packages/shared` に `package.json` + `tsconfig.json`（base 継承）、ルート `tsconfig.json` の `references` に登録 **[自分]**
- D1-4 `CLAUDE.md` / ルート `README.md` を本ピボットに刷新（TrendScope 記述の除去） **[自分]**
- D1-5 CI 改修：`ci.yml` の embedding/sqlfluff ジョブを削除、`lint`/`typecheck` を pnpm 化、`codeql.yml` を js-ts に **[自分]**（雛形は [AI] 可）

### Day 2（[INFRA] [BE]）
- D2-1 前提確認：Day 1 の 4 パッケージが `pnpm typecheck` を通る **[自分]**
- D2-2 `infra/compose.yaml`：postgres + volume + healthcheck + adminer、`infra/postgres/init/` で `pgcrypto` **[自分]**
- D2-3 `packages/db`：drizzle-orm + drizzle-kit 導入、`drizzle.config.ts`、`src/schema/users.ts` `src/schema/sessions.ts` **[自分]**
- D2-4 migration 生成・適用：`generate` → 生成 SQL を読む → `migrate`。adminer で確認 **[自分]**
- D2-5 seed：`src/seed.ts`（admin/member、パスワードはハッシュ化）。冪等 **[自分]**
- D2-6 DB テスト：Testcontainers で「migration が通る」「UNIQUE/FK/CHECK が効く」 **[自分]**（1 本目）/ [AI] で横展開

### Day 3（[BE] [TEST]）
- D3-1 前提確認：compose で postgres が上がり、`DATABASE_URL` で接続できる **[自分]**
- D3-2 Hono 骨格：`apps/api/src/app.ts`（ルート合成）、`src/index.ts`（`@hono/node-server` で起動）、`lib/config.ts`（zod で env 検証） **[自分]**
- D3-3 ミドルウェア：`middleware/logger.ts` `middleware/error.ts`（`code` 付き JSON）`middleware/cors.ts` **[自分]**
- D3-4 `GET /health`：DB に `select 1` して疎通込みで返す **[自分]**
- D3-5 `packages/shared`：`src/http.ts`（エラー形）、`src/user.ts`（`UserDto`）を zod で **[自分]**
- D3-6 api テスト：`app.request()` で `/health` 200、エラー整形、CORS ヘッダ **[自分]**（1 本目）/ [AI] 横展開

### Day 4（[BE] [TEST]）
- D4-1 前提確認：`/health` が緑、seed 済み **[自分]**
- D4-2 Argon2id の理解（実装は Day2-5 で `packages/db/src/lib/hash.ts` に済。**api には作らない**）。パラメータの意味をコメント **[自分]**
- D4-3 `db/users.ts` `db/sessions.ts`：`findUserByEmail` / `createSession` / `findSession` / `deleteSession` **[自分]**
- D4-4 `routes/auth.ts`：`POST /auth/login`（body を `LoginRequest.parse` → verify → セッション発行 → **署名付き** `Set-Cookie`）、`/logout`、`GET /auth/me` **[自分]**
- D4-5 `middleware/auth.ts` + `requireRole`：Cookie からセッション検証 → `c.set("user")`、role ガード **[自分]**
- D4-6 認証テスト：正常ログイン / 誤パスワード 401 / me 未認証 401 / member が admin API で 403 **[自分]**（マトリクス）/ [AI] 横展開

> **Day 5〜7 は元は 1 日だった。** React 未経験で「Vite + Tailwind + Query + context + Router + RHF + E2E」を 1 日に詰めるのは無理があるので 3 回に割った。
> **前提**: Day 5 に入る前に [notes/react_basics.md](../notes/react_basics.md) の素振りを済ませる（使い捨ての Vite プロジェクトで、props / state / 再レンダリング / effect / フォーム / context を手で確認する）。

### Day 5（[FE]）— 素の React で画面を作る
- D5-1 前提確認：`notes/react_basics.md` の素振り済み、api が動く **[自分]**
- D5-2 Vite + React + **Tailwind v4** 立ち上げ（`tailwind.config.js` / `postcss.config.js` は作らない）、Vite proxy で `/api` → :8787 **[自分]**
- D5-3 `components/Field.tsx` + **静的な `LoginForm`（`useState` だけ。API に繋がない）** + `LoginPage` **[自分]**
- D5-4 再レンダリングを観察する小演習（`console.log` + Profiler。**最適化はしない**） **[自分]**

### Day 6（[FE] [TEST]）— API と繋ぐ
- D6-1 前提確認：Day 5 の静的画面が動く、api + postgres 起動、context の素振り済み **[自分]**
- D6-2 `lib/api/client.ts`：`fetch` ラッパ（`credentials: "include"`、`ApiError`）。`lib/api/auth.ts` **[自分]**
- D6-3 `lib/query.ts`（`queryClient` を単独で）+ `app/providers.tsx` + `features/auth/AuthProvider.tsx` + `useAuth`（`me` の 401 を「未ログイン」に吸収） **[自分]**
- D6-4 `LoginForm` を **RHF + zod resolver + `useMutation`** に置き換えて実ログイン。**Day 5 の `useState` 版と比べて RHF が何を肩代わりしたか言語化する** **[自分]**
- D6-5 web の単体テスト 1 本（Vitest + Testing Library + MSW）、CI に `test-web` を追加 **[自分]**（1 本目）/ [AI] 横展開

### Day 7（[FE] [設計]）— 器を組む
- D7-1 前提確認：Day 6 で実ログインできる、`queryClient` が `lib/query.ts` にある **[自分]**
- D7-2 `app/router.tsx`（`createBrowserRouter`、**data router モード**）、`requireAuth` loader（`ensureQueryData` で `["me"]` を共有）、`from` で元ページに戻す **[自分]**
- D7-3 `DashboardShell`（サイドバー + ヘッダ + Outlet + ログアウト → `queryClient.clear()`） **[自分]**
- D7-4 `screens/registry.ts` + `/catalog`。**1 エントリ足すとナビ・ルート・カタログに自動反映**、`requiredRole` で出し分け **[自分]**

## 進めるときの 1 サイクル

1. その日の `dayX.md` を開き、`DayX-1`（前提確認）から順に。
2. 1 タスク = 1 ブランチ = 1 PR。ブランチ名は `sprint1/dayX-N-<slug>`（例 `sprint1/day2-3-drizzle-schema`）。
   **例外**: `DayX-1`（前提確認）と Day5-4（観察のみ）は成果物が無いので PR にしない。
3. 実装 → ローカルで `pnpm lint && pnpm typecheck && <該当 filter> test` → 緑を確認。
4. Conventional Commits でコミット（commitlint が commit-msg で強制）。
5. PR を出し CI 緑 → セルフレビュー（`/pair-review` スキル）→ マージ。
6. `dayX.md` のチェックリストにチェック。詰まったら下表。

## つまづいたらここを見る

| 症状 | 参照先 |
|---|---|
| pnpm workspace で内部パッケージが解決されない | [03_architecture.md](03_architecture.md) の「内部パッケージの解決」/ `pnpm-workspace.yaml` と `workspace:*` |
| `Cannot find module '@app/shared'` | **`dist` が無い**。`pnpm build` を先に。[03_architecture.md](03_architecture.md) の「内部パッケージの解決」 |
| `referenced project may not disable emit` | `apps/web` は `composite: false` + ルート `references` から除外。[03_architecture.md](03_architecture.md) |
| **`Relative import paths need explicit file extensions`** | `module: NodeNext` のため **api の相対 import は `.js` 拡張子が要る**（`./app.js`）。web は `Bundler` なので不要。[sprint1/day3.md](sprint1/day3.md) Day3-2 の「詰まったら」 |
| `tsc -b` が references を見ない | [docs/conventions/TOOLING.md](../docs/conventions/TOOLING.md) の「app を作ったときに有効化される配線」 |
| migration 生成 SQL がおかしい | [04_database.md](04_database.md) の「migration 運用」 |
| Cookie がブラウザに保存されない / 送られない | [06_auth.md](06_auth.md) の Cookie 属性 + [05_api.md](05_api.md) の CORS（`credentials`） |
| CORS プリフライトで落ちる | [05_api.md](05_api.md) のミドルウェア（`WEB_ORIGIN`、`credentials: true`） |
| React Router の loader で無限リダイレクト | [07_frontend.md](07_frontend.md) のルーティング（`requireAuth` は `me` を `ensureQueryData`、`null` で 1 回だけ redirect） |
| Testcontainers が起動しない | Docker が動いているか。CI では `services:` の postgres でも可 |

## Sprint 1 完了後に残るタスク（Sprint 2 以降）

- `screens/` に最初の実画面（ユーザー一覧 → 詳細 → 作成/削除）。[09_screen_catalog.md](09_screen_catalog.md) の #1〜3
- **Bot 検知の段 0**（`request_logs` + 記録 middleware + シグナル/ルールの型 + 一覧画面）。[11_bot_detection.md](11_bot_detection.md) / [09](09_screen_catalog.md) の #16。**#1 より先でもよい** —— 本物のデータ量が溜まるので、ページング・インデックス・`EXPLAIN` の練習台になる
- `labs/prisma-compare/` で Drizzle と Prisma の比較（隔離ラボ）。[02_tech_stack.md](02_tech_stack.md)
- Renovate（or Dependabot）を入れて依存更新 PR を回す運用を始める。[08_infra_ops.md](08_infra_ops.md)
- 認証を Step 2〜4 へ（Cookie 属性の作り込み → JWT 比較 → 認可マトリクス拡張）。[06_auth.md](06_auth.md)
- **E2E（Playwright）1 本**：「/login → admin ログイン → /dashboard にシェル」。器が固まった Sprint 2 の頭で。あわせて CI に `e2e` / `build-images` を追加。[08_infra_ops.md](08_infra_ops.md)
- **CORS を実際に踏む回**：Vite proxy を外して api を直叩きし、プリフライト失敗 / `Allow-Credentials` 無しで Cookie が飛ばない / `Allow-Origin: *` と credentials の併用不可 を体験する。[05_api.md](05_api.md)
- `docs/conventions/*.md` のリンク切れ・題材例を新プロジェクトに合わせて修正。[10_conventions_pointer.md](10_conventions_pointer.md)
- `.agents/skills/{pair-start,sprint-plan}` の `design/sprint*/day*.md` 前提記述を現構成に合わせて微修正
