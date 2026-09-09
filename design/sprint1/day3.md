# Sprint 1 Day 3 作業指示書

> テーマ: Hono API の骨格 —— 起動・設定検証・ミドルウェア・ヘルスチェック・共有 DTO
> 完了時の状態: `pnpm --filter @app/api dev` で API が :8787 で起動し、`GET /health` が DB 疎通込みで `200` を返す。エラーは統一 JSON。CORS がフロント origin を許可。`packages/shared` に最初の DTO。api の Vitest 1 本が緑。
> 推定所要: 2.5〜3 時間
> 主に踏む層: `[BE]` `[TEST]`

参照: [design/05_api.md](../05_api.md)（API 設計・エラー・ミドルウェア）/ [design/03_architecture.md](../03_architecture.md)（設定・ポート）/ [docs/conventions/typescript.md](../../docs/conventions/typescript.md)

---

## Day3-1. 前提確認 [自分] [BE]

**前提確認**
- [ ] `docker compose -f infra/compose.yaml up -d` で postgres が healthy
- [ ] `pnpm --filter @app/db migrate` 適用済み、seed 済み
- [ ] `packages/db` の barrel から **`pgClient`（postgres.js）/ `db`（Drizzle）/ `schema`** が import できる（Day2-3 で名前を分けた）
- [ ] `.env` に `DATABASE_URL` がある

**完了確認**
- [ ] `node --env-file=.env -e "import('@app/db').then(m=>m.pgClient\`select 1\`).then(r=>console.log(r))"` 相当で疎通する（ワンライナーが難しければ Day3-4 で確認でよい）

---

## Day3-2. Hono アプリの骨格 [自分] [BE] [設計]

**目的**
「リクエストが来てレスポンスを返すまで」を 1 ファイルで追える最小構成を作る。`app.ts`（ルート合成）と `index.ts`（起動）を分けるのは、テストで `app` だけ import したいから（[05_api.md](../05_api.md)）。

**自分で書く理由**
API のエントリ構造は自分で説明できる必要がある。`config` の検証を「起動時に一度」やる設計判断も含む。

**前提確認**
- [ ] [design/05_api.md](../05_api.md) の「原則」「ミドルウェア」節を読んだ
- [ ] [design/03_architecture.md](../03_architecture.md) の「設定（環境変数）」節を読んだ

**手順**
1. 依存追加:
   ```
   pnpm --filter @app/api add hono @hono/node-server zod
   pnpm --filter @app/api add -D vitest tsx
   ```
2. `apps/api/src/lib/config.ts`。**ヒント**:
   - `const EnvSchema = z.object({ DATABASE_URL: z.string().url(), PORT: z.coerce.number().default(8787), WEB_ORIGIN: z.string().url(), SESSION_SECRET: z.string().min(32), NODE_ENV: z.enum(["development","test","production"]).default("development") })`
   - `export const config = EnvSchema.parse(process.env)`
   - パース失敗時は zod がエラーを投げる → プロセスが起動しない（それが正しい）
3. `apps/api/src/app.ts`。**ヒント**:
   - `const app = new Hono()`
   - ミドルウェアを `app.use("*", ...)` で登録（Day3-3 で中身）
   - ルートを合成（今は health だけ、Day 4 で `/api/auth` を `app.route()`）
   - `export { app }`
4. `apps/api/src/index.ts`。**ヒント**:
   - `import { serve } from "@hono/node-server"`
   - `import { app } from "./app"`, `import { config } from "./lib/config"`
   - `serve({ fetch: app.fetch, port: config.PORT }, (info) => console.log(\`api on :\${info.port}\`))`
5. `apps/api/package.json` の `scripts`:
   ```json
   { "dev": "tsx watch --env-file=../../.env src/index.ts",
     "start": "node --env-file=../../.env dist/index.js",
     "typecheck": "tsc -b",
     "test": "vitest run" }
   ```

**完了確認**
- [ ] `pnpm --filter @app/api dev` で `api on :8787` が出る
- [ ] `.env` から `SESSION_SECRET` を消すと**起動に失敗する**（config 検証が効いている）→ 戻す
- [ ] `pnpm --filter @app/api typecheck` 緑

**詰まったら**
- **`Relative import paths need explicit file extensions` / 実行時に `ERR_MODULE_NOT_FOUND`** → `tsconfig.base.json` が `module: NodeNext` なので、**相対 import は `.js` 拡張子を書く**。`import { app } from "./app"` ではなく **`from "./app.js"`**（`.ts` ではない。「出力後のファイル名を書く」のが ESM の規則）。`apps/api` 全体でこれを守る。ここは初見で必ず踏む
  - パッケージ名の import（`@app/db`、`hono`）には拡張子は要らない。**相対パスだけ**
  - `apps/web` は `moduleResolution: Bundler` なので拡張子不要。**api と web で書き方が違う**ことに注意
- `tsx watch --env-file` が未対応 → `tsx` のバージョンを上げるか、`node --import tsx --env-file=../../.env src/index.ts` 相当に
- `Cannot find module '@app/db'` → deps に `"@app/db": "workspace:*"` があるか、`pnpm install` したか、**`packages/db` が build 済みか**（`pnpm build`。[03_architecture.md](../03_architecture.md) の「内部パッケージの解決」）

---

## Day3-3. ミドルウェア 3 種（logger / error / cors） [自分] [BE]

**目的**
横断処理を独立させる。特に **error ミドルウェアで例外を統一 JSON に整形**する型を作る（[05_api.md](../05_api.md) のエラー設計）。

**自分で書く理由**
エラー設計はアプリの品質を決める。`code` の enum、想定エラーと想定外の切り分けを自分で決める。

**前提確認**
- [ ] [design/05_api.md](../05_api.md) の「エラー設計」節（`code` enum、`{ error: { code, message, details } }` の形）を読んだ
- [ ] [docs/conventions/README.md](../../docs/conventions/README.md) の原則 5（エラーを握り潰さない）

**手順**
1. `apps/api/src/lib/errors.ts`。**ヒント**:
   - `type ErrorCode = "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INTERNAL"`
   - `class AppError extends Error { constructor(public code: ErrorCode, message: string, public status: number, public details?: unknown) { super(message) } }`
   - ヘルパ: `notFound(msg)`, `unauthorized(msg)`, `forbidden(msg)`, `conflict(msg)` など
2. `apps/api/src/middleware/error.ts`。**ヒント**:
   - Hono の `app.onError((err, c) => {...})` を使う（`app.ts` 側で登録）か、`createMiddleware` で try/catch
   - `err instanceof AppError` → `c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status)`
   - `err instanceof ZodError` → `400 VALIDATION_ERROR` + `details` に `err.issues` を整形
   - それ以外 → `console.error(err)`（スタックはログのみ）+ `c.json({ error: { code: "INTERNAL", message: "Internal Server Error" } }, 500)`
3. `apps/api/src/middleware/logger.ts`。**ヒント**:
   - 開始時刻を取る → `await next()` → `c.res.status` と経過 ms を 1 行 `console.log`
   - **body はログしない**（[05_api.md](../05_api.md)）。メソッド・パス・ステータス・ms・（あれば）requestId のみ
4. `apps/api/src/middleware/cors.ts`。**ヒント**:
   - Hono 組み込みの `cors` を使う: `cors({ origin: config.WEB_ORIGIN, credentials: true })`
   - `credentials: true` は Day 5 の Cookie 認証に必須
5. `app.ts` で登録順を意識: `logger` → `cors` → （ルート）。`onError` は `app.onError` で最外周。

**完了確認**
- [ ] 存在しないパス `GET /nope` が `404`（Hono デフォルト or 整形）
- [ ] わざと `throw new AppError("CONFLICT", "dup", 409)` するテストルートを一時的に置くと `409 { error: { code: "CONFLICT" } }`
- [ ] `curl -i -H "Origin: http://localhost:5173" http://localhost:8787/health` のレスポンスに `Access-Control-Allow-Origin: http://localhost:5173` と `Access-Control-Allow-Credentials: true`
- [ ] ログに `GET /health 200 3ms` のような 1 行が出る（body は出ていない）

**詰まったら**
- `onError` が呼ばれない → 非同期の throw を Hono が拾えているか。`app.get("/x", async (c) => { throw ... })` の形で
- CORS プリフライト（OPTIONS）が 404 → `cors` ミドルウェアを全ルートに `app.use("*", cors(...))` で

---

## Day3-4. GET /health（DB 疎通込み） [自分] [BE]

**目的**
「生きているか」だけでなく「DB に届くか」を返すヘルスチェック。compose の `depends_on` や Day 8 の監視で使う。

**前提確認**
- [ ] `@app/db` の `pgClient` が import できる
- [ ] [design/08_infra_ops.md](../08_infra_ops.md) の「ヘルスチェック」への言及を読んだ

**手順**
1. `apps/api/src/routes/health.ts`。**ヒント**:
   - `const health = new Hono()`
   - `health.get("/", async (c) => { try { await pgClient\`select 1\`; return c.json({ status: "ok", db: "ok" }) } catch { return c.json({ status: "ok", db: "down" }, 503) } })`
   - ここは**あえて Drizzle を通さず生 SQL**（疎通確認に ORM は要らない）。`pgClient` と `db` を使い分ける最初の例
   - DB が落ちていたら `503`（readiness の考え方）
2. `app.ts` で `app.route("/health", health)`。
3. `docker compose ... stop postgres` して `GET /health` が `503 { db: "down" }` になることを確認 → `start postgres` で戻る。

**完了確認**
- [ ] `curl -s http://localhost:8787/health` が `{"status":"ok","db":"ok"}`
- [ ] postgres を止めると `503` + `"db":"down"`、起動で復帰
- [ ] `/health` のログ 1 行が出る

**詰まったら**
- `pgClient\`select 1\`` の書き方 → `postgres` ライブラリのタグ付きテンプレート。`await pgClient\`select 1 as x\`` は配列を返す
- 常に `db: down` → `DATABASE_URL` が api プロセスに渡っているか（`--env-file`）

---

## Day3-5. packages/shared に最初の DTO [自分] [BE] [設計]

**目的**
フロントと API が共有する「契約」を zod スキーマで置く。Day 4 のログインで使う `LoginRequest` と、レスポンスの `UserDto`、共通エラー形。

**自分で書く理由**
境界の型は設計そのもの。「DB の行と API の DTO は別物」（`password_hash` を返さない）を自分の手で分ける。

**前提確認**
- [ ] [design/05_api.md](../05_api.md) の「リクエスト / レスポンスの型」「一覧レスポンスの形」を読んだ
- [ ] [docs/conventions/typescript.md](../../docs/conventions/typescript.md) の「型の使い方」（`unknown` → zod parse）

**手順**
1. `pnpm --filter @app/shared add zod`。
2. `packages/shared/src/http.ts`。**ヒント**:
   - エラーレスポンスの zod スキーマ（`error: { code, message, details? }`）と型
   - ページングの型（`{ page, perPage, total, totalPages }`）※ Day 5 では未使用でも置いておく
3. `packages/shared/src/auth.ts`。**ヒント**:
   - `LoginRequest = z.object({ email: z.string().email(), password: z.string().min(8) })`
   - `export type LoginRequest = z.infer<typeof LoginRequest>`
4. `packages/shared/src/user.ts`。**ヒント**:
   - `UserDto = z.object({ id: z.string().uuid(), email: z.string().email(), name: z.string(), role: z.enum(["admin","member"]), createdAt: z.string().datetime() })`
5. `packages/shared/src/index.ts` で全部 re-export。

**完了確認**
- [ ] `pnpm --filter @app/shared typecheck` 緑
- [ ] `apps/api` から `import { LoginRequest, UserDto } from "@app/shared"` できる（試しに `app.ts` で import して未使用 lint が出ることを確認 → 消す or Day 4 まで `// eslint-disable` しない方針なら import も Day 4 で）

**詰まったら**
- `@app/shared` の型が古いまま → `pnpm --filter @app/shared typecheck` で `dist` は作らず型だけ確認。`main` が `./src/index.ts` を指しているので TS はソースを直接見る

---

## Day3-6. api テスト 1 本 [自分] [TEST]

**目的**
`app.request()` でリクエストを流し、ステータス・ボディ・ヘッダを検証する型を作る。DB 不要なものと、DB が要るもの（Testcontainers）を分ける。

**前提確認**
- [ ] Day3-2〜3-4 が動く
- [ ] [design/05_api.md](../05_api.md) の「テスト」節

**手順**
1. `apps/api/vitest.config.ts`（最小）。
2. `apps/api/test/health.test.ts`。**検証**（実装ヒントまで）:
   - `import { app } from "../src/app"`
   - test 1: `const res = await app.request("/health")` → `res.status` が `200`、`await res.json()` が `{ status: "ok", db: ... }`
     （CI で DB が無ければ `db: "down"` の 503 も許容する分岐、または Testcontainers で立てる）
   - test 2: `GET /nope` が `404`
   - test 3: CORS —— `app.request("/health", { headers: { Origin: config.WEB_ORIGIN } })` のレスポンスヘッダに `access-control-allow-credentials: true`
3. `pnpm --filter @app/api test` が緑。

**完了確認**
- [ ] `pnpm --filter @app/api test` 緑（3 ケース）
- [ ] CI（Day 1 で改修した `ci.yml`）に `test-api` ジョブを追加して緑（Testcontainers or `services: postgres`）

**AI 依頼テンプレ**（横展開）
```
apps/api/test/health.test.ts と同じ app.request() パターンで、
<新ルート> の <正常系/異常系> を検証するテストを足したい。
既存ファイルを貼るので、describe を足す形で。
```

---

## Day 3 終了チェックリスト

- [ ] `pnpm --filter @app/api dev` で :8787 起動、`config` 検証が効く
- [ ] `GET /health` が DB 疎通込みで `200` / DB 断で `503`
- [ ] エラーが統一 JSON（`{ error: { code, message } }`）、logger が 1 行 / body 非出力
- [ ] CORS が `WEB_ORIGIN` + `credentials: true`
- [ ] `packages/shared` に `LoginRequest` / `UserDto` / エラー形
- [ ] `pnpm --filter @app/api test` 緑、CI に `test-api` 追加
- [ ] 各タスク 1 PR、CI 緑

## Day 4 への引き継ぎメモ

- Day 4 は `POST /api/auth/login` `/logout` `GET /api/auth/me` を DB ユーザー + Argon2 + Cookie セッションで。認可ミドルウェアも。
- `lib/hash.ts`（Argon2 wrap）、`db/users.ts` `db/sessions.ts`（クエリ関数）、`routes/auth.ts`、`middleware/auth.ts`。
- Cookie は `HttpOnly; SameSite=Lax; Path=/`（[06_auth.md](../06_auth.md)）。`Secure` は `NODE_ENV=production` のときだけ。
