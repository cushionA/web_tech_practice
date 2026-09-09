# SQL / PostgreSQL 規約

対象: `packages/db/drizzle/*.sql`（**Drizzle が生成する** migration）と、アプリから発行する SQL。設計の正は [`design/04_database.md`](../../design/04_database.md)。共通原則は [README.md](README.md)。

**スキーマの単一の正は `packages/db/src/schema/*.ts`**（TypeScript）。SQL は生成物であって手書きの原本ではない —— ここが旧構成との一番大きな違い。だから本書の役割は「生成された SQL を読んで判断できること」と「アプリから発行する SQL の書き方」の 2 つになる。

自動 lint は無し（sqlfluff は TrendScope 撤去時に外した）。**生成 SQL は人が読むことで守る**。より深い PostgreSQL チューニングは [`.agents/skills/supabase-postgres-best-practices/`](../../.agents/skills/supabase-postgres-best-practices/) を参照。

## マイグレーション規律

- **手で書かない。** `src/schema/*.ts` を編集 → `pnpm --filter @app/db generate` で `drizzle/NNNN_*.sql` を生成 → **生成 SQL を必ず読む** → `migrate` で適用（[`design/04_database.md`](../../design/04_database.md)）。
- **生成 SQL を手編集して辻褄を合わせない。** 意図と違う SQL が出たら schema を直して生成し直す。手編集すると schema と DB が乖離して、次の generate が壊れた差分を出す。
- **適用済みマイグレーションは編集しない。** スキーマを変えたいなら schema を変えて新しい migration を生成する（履歴が正）。
- **down マイグレーションは書かない。** 打ち消したいなら「打ち消す変更」を前進で足す（実務でもこの流儀が多い）。
- 1 マイグレーション = 1 つの意図。スキーマ変更とデータ移行を混ぜない。
- **アプリ起動時に自動 migrate しない**（複数インスタンスで競合する）。パイプラインの 1 ステップで流す（[`design/08_infra_ops.md`](../../design/08_infra_ops.md)）。
- 破壊的変更（列削除・型変更・NOT NULL 追加）は段階移行（追加 → バックフィル → 切替 → 旧削除）。ロックの長いDDLは [`lock-short-transactions`](../../.agents/skills/supabase-postgres-best-practices/references/lock-short-transactions.md) を参照。
- 大きいテーブルへのインデックスは `CREATE INDEX CONCURRENTLY`（ただしトランザクション外）。

## 命名

- **識別子は小文字 `snake_case`**。引用符付き識別子（`"CamelCase"`）は使わない（[`schema-lowercase-identifiers`](../../.agents/skills/supabase-postgres-best-practices/references/schema-lowercase-identifiers.md)）。
- テーブルは**複数形**（`users`, `sessions`, `audit_logs`, `request_logs`）。列は単数。
- 主キーは `id`。外部キーは `<参照先単数>_id`（`user_id`）。
- boolean は `is_`/`has_` 接頭辞（`is_active`, `is_read`）。時刻は `_at` 接尾辞で `timestamptz`（`created_at`, `expires_at`）。
- 制約・インデックスは役割が分かる名前: インデックス `idx_<table>_<cols>`、部分/特殊は説明的。CHECK は `<table>_<col>_check`（例: `users_role_check`）。
- **Drizzle 側の TS プロパティは camelCase、DB 側は snake_case**（`passwordHash: text("password_hash")`）。両方を意識して書く。

## 定義順（CREATE TABLE 内の列順）

「読む順 = 重要度順」。

**この順は `src/schema/*.ts` 側で守る**（生成 SQL の列順は schema の記述順に従う）。

1. `id`（主キー）
2. 外部キー（親への参照）
3. 本体の属性（業務的に重要な順）
4. ステータス・フラグ・カウンタ
5. 派生・生成列（`GENERATED ALWAYS AS ... STORED`）
6. `created_at` / `updated_at`（末尾）
7. テーブル制約（複合 `UNIQUE` / `CHECK` / 複合 `FOREIGN KEY`）と index

生成される SQL のイメージ（`sessions`。[`design/04_database.md`](../../design/04_database.md)）:

```sql
CREATE TABLE sessions (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_agent text,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
```

- **整形は気にしない**（Drizzle が出力する。人が揃え直しても次の generate で戻る）。読むのが仕事。
- テーブルごとの「何のためのテーブルか」は **schema の TS 側**にコメントで置く。

## 型の選択

- 文字列は **`text`**（`varchar(n)` を使わない。長さ制約は `CHECK` か境界バリデーションで）。
- 時刻は **`timestamptz`**（`timestamp` は使わない。UTC で保存）。日付集計キーは `date`。
- ID は `uuid DEFAULT gen_random_uuid()`。連番が要る所だけ `bigint GENERATED ALWAYS AS IDENTITY`。
- 列挙は `text` + `CHECK (col IN (...))`。enum 型は migration が重くなるため避ける。Drizzle では `text(..., { enum: [...] })` と `check()` の**両方**を書く（前者は TS の型だけ、後者が DB 制約）。
- 金額・正確な数値は `numeric`。スコア等の近似は `real`/`double precision`。
- 構造化データは `jsonb`（`json` でなく）。検索するキーは生成列か式インデックスに出す。
- ベクトルは `vector(768)`（pgvector）。配列は `text[]`。
- 型・制約の指針は [`schema-data-types`](../../.agents/skills/supabase-postgres-best-practices/references/schema-data-types.md) / [`schema-constraints`](../../.agents/skills/supabase-postgres-best-practices/references/schema-constraints.md)。

## 制約

- **不変条件は DB で守る**。アプリのバリデーションに頼り切らない（複数経路から書かれる）。
- `NOT NULL` を既定に。本当に省略可能なものだけ NULL 可。
- 外部キーに `ON DELETE` を明示（`CASCADE` / `SET NULL` を意図して選ぶ）。
- ビジネスルールは `CHECK` と複合 `UNIQUE`、部分ユニークインデックス（`WHERE` 付き）で表す。
- **`enum` は `text` + `CHECK` で表す**（Postgres enum は migration が面倒）。Drizzle では `text("role", { enum: [...] })`（**TS の型補助にすぎない**）に加えて、`pgTable` の第 3 引数で `check()` を書く。**両方書いて初めて型と DB 制約が揃う**（[`design/04_database.md`](../../design/04_database.md)）。
- 親子の一貫性を DB で守りたいときは**複合 `UNIQUE` / 複合外部キー**を使う。アプリの読み書き経路が増えても崩れない。

## インデックス

- **外部キーには基本インデックスを張る**（[`schema-foreign-key-indexes`](../../.agents/skills/supabase-postgres-best-practices/references/schema-foreign-key-indexes.md)）。
- **複合インデックスは「絞る列 → 並べる列」の順**（例: `request_logs` のキーセットページングなら `(at DESC, id DESC)`、IP 単位の集計なら `(ip_hash, at DESC)`。[`design/11_bot_detection.md`](../../design/11_bot_detection.md)）。
- 一部行だけ対象なら**部分インデックス**（`WHERE deleted_at IS NULL` 等）。
- 全文検索は `GENERATED` な `tsvector` + **GIN**（[`design/09_screen_catalog.md`](../../design/09_screen_catalog.md) #10 の題材）。
- 当て推量で張らない。`EXPLAIN ANALYZE`（[`monitor-explain-analyze`](../../.agents/skills/supabase-postgres-best-practices/references/monitor-explain-analyze.md)）で必要を確認してから。使われないインデックスは書き込みコストだけの負債。

## 行レベルの認可（このプロジェクトではやらない）

**マルチテナント・RLS は非ゴール**（[`design/01_goals_and_scope.md`](../../design/01_goals_and_scope.md)）。旧 TrendScope では PostgreSQL の RLS でテナントを分離していたが、本プロジェクトは単一テナントなので採用しない。

代わりに効かせる原則:

- **認可は API 層で 1 箇所に寄せる**。`middleware/auth.ts` でセッションからユーザーを解決し、`requireRole('admin')` でガードする（[`design/06_auth.md`](../../design/06_auth.md)）。SQL に認可条件を散らさない。
- **フロントの出し分けはセキュリティではない**。API 側が本丸。
- **認可マトリクスをテストで恒久ガード**する（member が admin 専用 API を叩いたら 403）。RLS の「越境マトリクス」が果たしていた役割を、ここが引き継ぐ（[`design/05_api.md`](../../design/05_api.md) のテスト節）。

> RLS 自体を学びたくなったら `labs/` で単独の題材として扱う（[`design/09_screen_catalog.md`](../../design/09_screen_catalog.md) の隔離ラボ）。PostgreSQL 側の作法は [`.agents/skills/supabase-postgres-best-practices/`](../../.agents/skills/supabase-postgres-best-practices/) に残してある。

## アプリから発行する SQL

- **常にパラメータ化**（`$1, $2`）。文字列連結で値を埋めない（SQL インジェクション）。識別子を動的にしたい場合はホワイトリスト経由。
- 読み取りは必要な列だけ `SELECT`（`SELECT *` をプロダクションコードで使わない）。
- **N+1 を作らない**（[`data-n-plus-one`](../../.agents/skills/supabase-postgres-best-practices/references/data-n-plus-one.md)）。ループ内クエリでなく `JOIN` か `WHERE id = ANY($1)`。
- 一括書込は**バッチ**（[`data-batch-inserts`](../../.agents/skills/supabase-postgres-best-practices/references/data-batch-inserts.md)）、再投入は `INSERT ... ON CONFLICT`（[`data-upsert`](../../.agents/skills/supabase-postgres-best-practices/references/data-upsert.md)）で冪等に。
- ページングは**まず `OFFSET` で分かりやすく作り、大きいデータの回でキーセットに差し替えて比較する**（[`design/05_api.md`](../../design/05_api.md)）。実務で選ぶべきはキーセット（[`data-pagination`](../../.agents/skills/supabase-postgres-best-practices/references/data-pagination.md)）。
- トランザクションは短く。ジョブ間の重複処理は `SELECT ... FOR UPDATE SKIP LOCKED`（[`lock-skip-locked`](../../.agents/skills/supabase-postgres-best-practices/references/lock-skip-locked.md)）。

## コメント

- **コメントは `src/schema/*.ts` 側に書く**（生成 SQL に書いても次の generate で消える）。各テーブルに「何のためか」を 1 行、非自明な制約・部分インデックスの条件には理由を添える。
- 「なぜこの index を張ったか」を schema のコメントに残す（[`design/04_database.md`](../../design/04_database.md)）。
- 関数を定義するなら `IMMUTABLE`/`STABLE`/`VOLATILE` の選択理由をコメントで残す。
- SQL キーワードは大文字、識別子は小文字で視認性を上げる。

## 禁止 / アンチパターン

- **生成 SQL の手編集**（schema と DB が乖離する）。適用済みマイグレーションの編集 / 番号の使い回し。
- down マイグレーションを書く。
- `varchar(n)` / `timestamp`（タイムゾーン無し）/ 引用符付き CamelCase 識別子。
- `text("role", { enum: [...] })` だけで DB 制約を張ったつもりになる（`check()` が要る）。
- アプリ起動時の自動 migrate。
- アプリでの SQL 文字列連結、`SELECT *`、ループ内 N+1。
- 当て推量インデックス / 外部キー無索引。

## レビューチェックリスト

- [ ] スキーマ変更は `src/schema/*.ts` 側で行い、SQL は生成した（**生成物を手編集していない**）
- [ ] **生成された SQL を読んだ**（型・NOT NULL・default・`ON DELETE`・CHECK が意図どおり）
- [ ] 新規マイグレーションは前進のみ（既存を編集していない・down を書いていない）
- [ ] 識別子は小文字 snake_case、型は `text`/`timestamptz`/`uuid`/`jsonb`
- [ ] 列順が id → FK → 属性 → 時刻、制約は末尾
- [ ] `NOT NULL`・`CHECK`・`ON DELETE`・複合 `UNIQUE`/FK で不変条件を DB で守っている
- [ ] enum 相当は `text` + `check()` の**両方**で守っている（TS の型補助だけになっていない）
- [ ] 外部キー・検索条件・ソート列に index があり、「なぜ張ったか」が schema にコメントされている
- [ ] アプリ SQL がパラメータ化・必要列のみ・N+1 無し
- [ ] Testcontainers のテストで「migration が空 DB に通る」「UNIQUE/FK/CHECK が効く」を検証した
