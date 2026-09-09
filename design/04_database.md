# 04. データベース設計

正: `packages/db/src/schema/*.ts`（Drizzle）。本書は**方針**。実テーブルは migration で育てる。

## 方針

- **最小から始める**。Sprint 1 は `users` と `sessions` だけ。画面を足すときにテーブルを足す（[09_screen_catalog.md](09_screen_catalog.md)）。
- **命名**: テーブルは複数形 `snake_case`（`users`, `audit_logs`）。カラムも `snake_case`。主キーは `id`。外部キーは `<単数>_id`（`user_id`）。
- **主キー**: `uuid`（`gen_random_uuid()`、`pgcrypto`）を既定。連番が欲しい表だけ `bigint identity`。
- **時刻**: `timestamptz`。`created_at` / `updated_at` を基本で持つ（`updated_at` はアプリ側 or トリガーで更新）。
- **論理削除はしない**（学習を複雑にする）。必要になった画面だけ `deleted_at` を検討。
- **enum はアプリ層の union + `text` + `CHECK`**（Postgres enum は migration が面倒）。例: `role text not null check (role in ('admin','member'))`。
- **NOT NULL をデフォルトに**。null を許すのは「未入力が意味を持つ」列だけ。
- **インデックス**: 外部キー・検索条件・ユニーク制約に明示的に張る。「なぜこの index か」を migration のコメントに書く。

## Sprint 1 のスキーマ（最小）

### users

| カラム | 型 | 制約 | 備考 |
|---|---|---|---|
| id | uuid | PK, default gen_random_uuid() | |
| email | text | NOT NULL, UNIQUE | ログイン ID |
| password_hash | text | NOT NULL | Argon2id。**平文は保存しない** |
| name | text | NOT NULL | 表示名 |
| role | text | NOT NULL, CHECK in ('admin','member'), default 'member' | 認可用 |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

- index: `email` の UNIQUE（自動）。

### sessions（Cookie セッション方式で使う）

| カラム | 型 | 制約 | 備考 |
|---|---|---|---|
| id | uuid | PK, default gen_random_uuid() | これが Cookie `sid` の値 |
| user_id | uuid | NOT NULL, FK → users(id) ON DELETE CASCADE | |
| expires_at | timestamptz | NOT NULL | 失効時刻 |
| created_at | timestamptz | NOT NULL, default now() | |
| user_agent | text | | 監査・不審検知の練習用（任意） |

- index: `user_id`、`expires_at`（期限切れ掃除のバッチ用）。
- JWT 方式を学ぶ回では `sessions` は使わず、`refresh_tokens` テーブルを別途作って比較する。

## migration 運用

- ツール: **drizzle-kit**。`packages/db/src/schema/*.ts` を編集 → `pnpm --filter db generate` で `drizzle/NNNN_*.sql` を生成 → レビュー → `pnpm --filter db migrate` で適用。
- **生成 SQL を必ず読む**。破壊的変更（列削除・型変更）は生成物を手で調整し、意図をコメント。
- 1 migration = 1 論理変更。PR に含める。
- 本番想定の運用（`migrate` を起動時 or CI/CD の 1 ステップで流す）は [08_infra_ops.md](08_infra_ops.md)。
- ロールバックは「打ち消す migration を前進で書く」。down マイグレーションは書かない（学習用には前進のみで十分、実務でもこの流儀は多い）。

## シード

- `packages/db/src/seed.ts`：開発用の初期データ。
  - admin ユーザー 1（`admin@example.com` / 既知のパスワード）
  - member ユーザー数名
  - 画面を足したらそのテーブルのダミーも足す
- `pnpm --filter db seed` で流す。冪等（`onConflictDoNothing` 等）に書く。
- **シードのパスワードもハッシュ化して入れる**（平文を書かない練習）。

## テスト

- `packages/db` と `apps/api` のクエリテストは **Testcontainers で本物の Postgres** を立てて実行（[docs/conventions/sql.md](../docs/conventions/sql.md) / TOOLING.md）。
- 見るもの: migration が空 DB に通ること、ユニーク制約・FK・CHECK が効くこと、代表クエリが期待行を返すこと、N+1 が無いこと（クエリ数をアサート）。

## 学習トピック（この層で身につけたいこと）

- 正規化（1NF〜3NF）と、あえて崩す判断
- 外部キーと ON DELETE の挙動（CASCADE / RESTRICT / SET NULL）
- トランザクション分離レベルとロック（`SELECT ... FOR UPDATE`）
- インデックスの種類（B-tree / GIN / 部分 index）と EXPLAIN の読み方
- N+1 問題と JOIN / `in` / データローダでの解消
- ページング（OFFSET vs キーセット / カーソル）
- JSONB を使う場面と使わない場面
