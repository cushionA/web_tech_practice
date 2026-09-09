# Sprint 1 Day 2 作業指示書

> テーマ: DB を立て、スキーマを Drizzle で定義し、migration とシードを回す
> 完了時の状態: `docker compose -f infra/compose.yaml up -d` で postgres が上がり、`pnpm --filter @app/db migrate` で `users`/`sessions` が作られ、`pnpm --filter @app/db seed` で admin/member が入る。adminer で中身が見える。DB テスト 1 本が緑。
> 推定所要: 2.5〜3.5 時間
> 主に踏む層: `[INFRA]` `[BE]`

参照: [design/04_database.md](../04_database.md)（スキーマ方針・migration 運用）/ [design/02_tech_stack.md](../02_tech_stack.md)（なぜ Postgres + Drizzle）/ [docs/conventions/sql.md](../../docs/conventions/sql.md)

---

## Day2-1. 前提確認 [自分] [INFRA]

**前提確認**
- [ ] Day 1 の 4 パッケージが `pnpm typecheck` を通る
- [ ] `docker compose version` が動く、Docker Desktop 起動中
- [ ] `psql` があると便利（無くても adminer で代替可）

**完了確認**
- [ ] `pnpm install` がクリーン
- [ ] `git branch --show-current` が Day 2 用ブランチ（`sprint1/day2-1-...`）

---

## Day2-2. infra/compose.yaml で postgres を立てる [自分] [INFRA]

**目的**
「ローカルの DB は Docker で使い捨てにする」を体で覚える。healthcheck / volume / init スクリプトという compose の基本要素を最初に触る。

**自分で書く理由**
`compose.yaml` は「開発環境の定義」。面接で「ローカルどうやって立てるの」に即答できる必要がある。

**前提確認**
- [ ] [design/03_architecture.md](../03_architecture.md) の「ローカル: Docker Compose」節を読んだ
- [ ] [design/08_infra_ops.md](../08_infra_ops.md) の compose 表を読んだ

**手順**
1. `infra/` を作り直す（旧 infra は削除済み）。`infra/compose.yaml`:
   ```yaml
   name: portfolio-learning
   services:
     postgres:
       image: postgres:<最新安定版>
       environment:
         POSTGRES_USER: app
         POSTGRES_PASSWORD: app
         POSTGRES_DB: app
       ports: ["5432:5432"]
       volumes:
         - pgdata:/var/lib/postgresql/data
         - ./postgres/init:/docker-entrypoint-initdb.d:ro
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U app -d app"]
         interval: 3s
         timeout: 3s
         retries: 10
     adminer:
       image: adminer
       ports: ["8080:8080"]
       depends_on:
         postgres:
           condition: service_healthy
   volumes:
     pgdata:
   ```
2. `infra/postgres/init/01_extensions.sql`:
   ```sql
   create extension if not exists pgcrypto;  -- gen_random_uuid() のため
   ```
3. `.env`（ルート、gitignore 済みか確認。無ければ `.gitignore` に追加）:
   ```
   DATABASE_URL=postgres://app:app@localhost:5432/app
   ```
4. `.env.example`（コミットする。ダミー値）:
   ```
   DATABASE_URL=postgres://app:app@localhost:5432/app
   PORT=8787
   WEB_ORIGIN=http://localhost:5173
   SESSION_SECRET=change-me-32-chars-minimum-string
   NODE_ENV=development
   ```
5. `docker compose -f infra/compose.yaml up -d` → `docker compose -f infra/compose.yaml ps` で healthy 確認。

**完了確認**
- [ ] `docker compose -f infra/compose.yaml ps` で postgres が `healthy`
- [ ] `http://localhost:8080`（adminer）に接続できる（System: PostgreSQL, Server: postgres, User/Pass/DB: app）
- [ ] `psql "$DATABASE_URL" -c "select 1"` が `1` を返す（psql があれば）
- [ ] `.env` は `git status` に出ない（gitignore されている）、`.env.example` は出る

**詰まったら**
- `port 5432 already allocated` → ホストで別 postgres が動いている。止めるか compose 側を `5433:5432` に
- init スクリプトが走らない → volume を作り直す必要がある（`docker compose ... down -v` してから `up`）。init は**初回のみ**実行される
- adminer で `could not translate host name "postgres"` → adminer コンテナから見た postgres のサービス名は `postgres`。ホストからは `localhost`

---

## Day2-3. packages/db に Drizzle とスキーマを入れる [自分] [BE] [設計]

**目的**
スキーマを TS で書き、そこから型と migration SQL を生成する Drizzle のやり方を身につける。`users` と `sessions` の 2 表だけ（[design/04_database.md](../04_database.md)）。

**自分で書く理由**
スキーマ設計は面接の頻出。カラム型・制約・index を「なぜそうしたか」まで自分で決める。

**前提確認**
- [ ] [design/04_database.md](../04_database.md) の「Sprint 1 のスキーマ（最小）」を読んだ
- [ ] `users`（id/email/password_hash/name/role/created_at/updated_at）と `sessions`（id/user_id/expires_at/created_at/user_agent）のカラムを頭に入れた

**手順**
1. `packages/db` に依存を追加:
   ```
   pnpm --filter @app/db add drizzle-orm postgres
   pnpm --filter @app/db add -D drizzle-kit
   ```
2. `packages/db/drizzle.config.ts`:
   ```ts
   import { defineConfig } from "drizzle-kit";
   export default defineConfig({
     schema: "./src/schema/index.ts",
     out: "./drizzle",
     dialect: "postgresql",
     dbCredentials: { url: process.env.DATABASE_URL! },
   });
   ```
3. `packages/db/src/schema/users.ts` を書く。**ヒント**（完成形は書かない）:
   - `pgTable("users", { ... })`
   - `id: uuid("id").primaryKey().defaultRandom()`
   - `email: text("email").notNull().unique()`
   - `passwordHash: text("password_hash").notNull()`
   - `role: text("role", { enum: ["admin", "member"] }).notNull().default("member")`
     — Postgres enum ではなく `text` + アプリ側 union（[04_database.md](../04_database.md)）
     — **`{ enum: [...] }` は TS の型補助だけで、DB の CHECK 制約にはならない。** DB 側も縛るために `pgTable` の第 3 引数で `check()` を足す:
       ```ts
       import { check } from "drizzle-orm/pg-core";
       import { sql } from "drizzle-orm";
       // pgTable("users", {...}, (t) => [ check("users_role_check", sql`${t.role} in ('admin','member')`) ])
       ```
     — **migration SQL を手編集しない**（`packages/db/src/schema/*.ts` が単一の正。[04_database.md](../04_database.md)）
   - `createdAt` / `updatedAt`: `timestamp("created_at", { withTimezone: true }).notNull().defaultNow()`
4. `packages/db/src/schema/sessions.ts`:
   - `userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" })`
   - `expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()`
   - index: `index("sessions_user_id_idx").on(t.userId)` など（Drizzle の `index()` ヘルパ）
5. `packages/db/src/schema/index.ts` で両方 re-export。
6. `packages/db/src/client.ts`：**2 つを別の名前で公開する**（責務が違うため。ここが曖昧だと Day3/Day4 で迷う）
   - `export const pgClient = postgres(process.env.DATABASE_URL!)` — postgres.js の**低レベルクライアント**。タグ付きテンプレートで生 SQL を書く用（`/health` の `select 1` など）
   - `export const db = drizzle(pgClient, { schema })` — **Drizzle インスタンス**。型付きクエリはすべてこちら
   - `pgClient` を直接使うのは「Drizzle で書けない / 書く意味がない」場面だけ、と決めておく
   - **`sql` という名前にしない**：`drizzle-orm` の `sql` テンプレートヘルパ（`check()` で使う）と衝突する
7. `packages/db/src/index.ts`（barrel）で `pgClient` / `db` / `schema` / `hashPassword` / `verifyPassword` を公開。

**完了確認**
- [ ] `pnpm --filter @app/db typecheck` が緑
- [ ] `pnpm --filter @app/db exec drizzle-kit --version` が動く
- [ ] スキーマファイルを読んで、各カラムの型・制約の理由を口で説明できる

**詰まったら**
- `drizzle-kit` が `DATABASE_URL` を読めない → `drizzle.config.ts` 実行時に env が要る。`dotenv` を入れて `import "dotenv/config"` を config 冒頭に、または `node --env-file=.env`（Node 20.6+ なら後者が使える）
- `references(() => users.id)` で循環参照エラー → セッション側から users を import する形で OK。関数で包めば遅延評価される

---

## Day2-4. migration を生成・適用する [自分] [INFRA] [BE]

**目的**
「スキーマを変えたら SQL を生成して、中身を読んでから適用する」サイクルを回す。生成された SQL を読むのが肝（ORM に何をさせているか知る）。

**自分で書く理由**
migration 運用は実務の心臓。生成物を鵜呑みにせず読む習慣をここで作る。

**前提確認**
- [ ] postgres が healthy（Day2-2）
- [ ] スキーマが typecheck を通る（Day2-3）
- [ ] [design/04_database.md](../04_database.md) の「migration 運用」を読んだ

**手順**
1. `packages/db/package.json` の `scripts` に:
   ```json
   {
     "generate": "drizzle-kit generate",
     "migrate": "drizzle-kit migrate",
     "studio": "drizzle-kit studio"
   }
   ```
   （env の渡し方は Day2-3「詰まったら」に従う）
2. `pnpm --filter @app/db generate` → `packages/db/drizzle/0000_*.sql` が生成される。
3. **生成 SQL を開いて全部読む**。`create table users (...)`、`create unique index`、FK 制約、`create table sessions (...)`。想定と合っているか（型・NOT NULL・default・onDelete）。
4. 生成 SQL に **`CHECK (role in ('admin','member'))` が含まれているか確認する**。無ければ Day2-3 の `check()` が抜けている → **SQL を手で足すのではなく schema を直して `generate` し直す**（schema が単一の正）。
5. `pnpm --filter @app/db migrate` で適用。
6. adminer で `users` `sessions` テーブルと `__drizzle_migrations`（適用履歴）を確認。

**完了確認**
- [ ] `drizzle/0000_*.sql` が存在し、内容を読んだ
- [ ] adminer に `users` `sessions` が見える。カラム・制約が SQL のとおり
- [ ] `pnpm --filter @app/db migrate` を再実行しても「適用済み」で何も起きない（冪等）

**詰まったら**
- `relation "__drizzle_migrations" already exists` → 既に適用済み。問題なし
- 型を間違えて生成した → スキーマを直し、`drizzle/` の該当ファイルを削除して `generate` し直す（まだ本番が無いので作り直してよい）。適用済みなら `docker compose ... down -v` で DB を捨てて再構築が早い

---

## Day2-5. seed を書く [自分] [BE] [INFRA]

**目的**
開発用の初期ユーザーを入れる。**パスワードは平文で書かずハッシュ化して入れる**（Day 4 の Argon2 を先取り）。冪等に書く。

**前提確認**
- [ ] migration 適用済み（Day2-4）
- [ ] [design/04_database.md](../04_database.md) の「シード」節を読んだ

**手順**
1. `packages/db` に `pnpm --filter @app/db add @node-rs/argon2`（Day 4 で api も使う）。
2. **`packages/db/src/lib/hash.ts` を作る（ここが唯一の実装。[06_auth.md](../06_auth.md) Step 1 の決定事項）**:
   - `hashPassword(plain): Promise<string>` / `verifyPassword(hash, plain): Promise<boolean>` の 2 本だけ
   - **`packages/shared` には置かない**（web のバンドルに載る。argon2 は Node 専用）。**`apps/api` にも置かない**（db が app を import する逆流になる）
   - Day 4 の api はこれを `@app/db` から import する。**同じ実装を 2 箇所に書くと、seed と検証でライブラリがズレて必ず詰む**
   - パラメータの意味のコメントは Day4-2 で深掘りするので、今は既定値 + TODO で可
   - barrel（`src/index.ts`）から export する
3. `packages/db/src/seed.ts`。**ヒント**:
   - `db` と `schema`、`hashPassword` を import
   - `hashPassword("password")` で admin/member のパスワードハッシュを作る
   - `db.insert(schema.users).values([...]).onConflictDoNothing({ target: schema.users.email })`
   - admin: `admin@example.com` / member: `member@example.com`（パスワードはどちらも `password` でよい。**学習用ローカル限定**）
   - 実行後に `select count(*)` して件数をログ
4. `packages/db/package.json` の `scripts` に `"seed": "node --env-file=../../.env src/seed.ts"`（`tsx` を使うなら `tsx src/seed.ts`）。
5. `pnpm --filter @app/db seed` を 2 回実行して、2 回目で増えないことを確認。

**完了確認**
- [ ] adminer で `users` に admin/member が入っている
- [ ] `password_hash` が `$argon2id$...` 形式（平文でない）
- [ ] `hashPassword` / `verifyPassword` が `packages/db/src/lib/hash.ts` **だけ**にある（api 側に複製していない）
- [ ] seed を 2 回流しても件数が変わらない（冪等）

**詰まったら**
- `@node-rs/argon2` が native ビルドで失敗（環境依存） → 代替に `bcryptjs`（pure JS）で一旦進めてよい。Day 4 で Argon2 に戻す
- `node --env-file` が使えない（Node < 20.6） → Active LTS のはず。Node を上げる

---

## Day2-6. DB テスト（Testcontainers）1 本 [自分] [TEST]

**目的**
「本物の Postgres を使い捨てで立てて、migration とスキーマ制約が効くことを検証する」テストの型を作る。1 本作れば以降は複製できる。

**自分で書く理由**
テスト戦略（何を検証するか）は設計。最初の 1 本の観点を自分で決める。

**前提確認**
- [ ] Docker が動いている（Testcontainers が使う）
- [ ] [docs/conventions/sql.md](../../docs/conventions/sql.md) のテスト節、[design/04_database.md](../04_database.md) の「テスト」節を読んだ

**手順**
1. `packages/db` に `pnpm --filter @app/db add -D vitest @testcontainers/postgresql`。
2. `packages/db/vitest.config.ts`（最小）。
3. `packages/db/test/schema.test.ts`。**検証したいこと**（実装はヒントまで）:
   - `beforeAll`: `new PostgreSqlContainer("postgres:<最新安定版>").start()` → 得た URL で drizzle クライアント作成 → `migrate()` をプログラムから実行（`drizzle-orm/postgres-js/migrator` の `migrate`）
   - test 1: `users` に insert できる
   - test 2: 同じ email で 2 回 insert すると UNIQUE 違反で throw する
   - test 3: 存在しない `user_id` で `sessions` に insert すると FK 違反で throw する
   - test 4: `role` に `'superadmin'` を入れると CHECK 違反で throw する（**`check()` が DB まで効いていることの確認**。TS の `{ enum: [...] }` だけでは通ってしまう）
   - `afterAll`: `container.stop()`
4. `packages/db/package.json` に `"test": "vitest run"`。
5. `pnpm --filter @app/db test` が緑。

**完了確認**
- [ ] `pnpm --filter @app/db test` が緑（4 ケース）
- [ ] わざとスキーマを壊す（UNIQUE を外す）とテストが赤くなる → 戻す

**詰まったら**
- コンテナ起動が遅い / タイムアウト → `vitest` の `testTimeout` を 60s に。初回は image pull で時間がかかる
- CI で Testcontainers が動かない → GitHub Actions は Docker が使えるので基本動く。ダメなら `services: postgres:` に切替（Day 3 以降で調整）

**AI 依頼テンプレ**（2 本目以降の複製）
```
packages/db/test/schema.test.ts と同じ Testcontainers セットアップで、
<新テーブル> の <制約> を検証するテストを追加したい。
既存ファイルを貼るので、beforeAll/afterAll は流用し test ケースだけ足して。
```

---

## Day 2 終了チェックリスト

- [ ] `docker compose -f infra/compose.yaml up -d` で postgres + adminer が healthy
- [ ] `packages/db` に Drizzle スキーマ（`users` / `sessions`）+ `drizzle/0000_*.sql`
- [ ] `pnpm --filter @app/db migrate` で適用でき、冪等
- [ ] `pnpm --filter @app/db seed` で admin/member（ハッシュ済み）が入り、冪等
- [ ] `pnpm --filter @app/db test` が緑
- [ ] `.env`（非コミット）/ `.env.example`（コミット）が揃っている
- [ ] 各タスク 1 PR、CI 緑

## Day 3 への引き継ぎメモ

- Day 3 は `apps/api` に Hono を入れて `GET /health`（DB 疎通込み）+ ミドルウェア（logger/error/cors）+ `packages/shared` に DTO。
- api は `@app/db` の **`pgClient`**（postgres.js クライアント）を import して `select 1` する。型付きクエリは `db`（Drizzle）を使う。**2 つの違いを意識する**。
- `lib/config.ts` で `.env` を zod 検証。`SESSION_SECRET` はここで必須にする（Day 4 で使う）。
