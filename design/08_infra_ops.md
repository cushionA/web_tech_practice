# 08. インフラ・運用

「土台知識」の一角。**`docker compose up` で全部立ち、CI が緑ならマージ**が完了ライン（本番デプロイはスコープ外、[01_goals_and_scope.md](01_goals_and_scope.md)）。

## ローカル: Docker Compose

`infra/compose.yaml`：

| サービス | イメージ / build | 役割 |
|---|---|---|
| `postgres` | `postgres`（Active な最新安定版） | DB。volume で永続化。`infra/postgres/init/` で拡張有効化（`pgcrypto`） |
| `api` | `apps/api/Dockerfile`（or dev は bind mount + `pnpm dev`） | Hono サーバ |
| `web` | `apps/web/Dockerfile`（or dev は Vite） | フロント |
| `adminer` | `adminer` | DB を GUI で覗く（学習用、任意） |

- **開発モード**: `postgres` + `adminer` だけ compose で立て、`api`/`web` はホストで `pnpm --filter api dev` / `--filter web dev`（ホットリロードが速い）。
- **通しモード**: 全部 compose（`api`/`web` もコンテナ）。E2E や「本番に近い形」の確認用。
- ヘルスチェック: `postgres` は `pg_isready`、`api` は `GET /health`。`api` は `depends_on: postgres (condition: service_healthy)`。
- `.env` を compose が読む。秘密はコミットしない。`.env.example` を用意。

## Dockerfile 方針

- **マルチステージ**：`deps`（pnpm install）→ `build`（tsc / vite build）→ `runtime`（`node:<Active LTS>-slim`、非 root ユーザー、成果物だけコピー）。
- `.dockerignore` で `node_modules` / `.git` / テストを除外。
- api の runtime は `node apps/api/dist/index.js`。web の runtime は静的ファイルを nginx or `vite preview`（学習用なら preview で十分）。
- イメージサイズと build キャッシュ（レイヤ順）を意識する回を作る。

## migration の運用

- ローカル: `pnpm --filter db migrate` を手で。
- 通しモード / CI: `api` 起動前に migration を流す専用ステップ（compose なら `migrate` ワンショットサービス、CI なら job のステップ）。
- **アプリ起動時に自動 migrate はしない**（複数インスタンス起動時に競合する。実務の定番は「デプロイパイプラインの 1 ステップ」）。この理由をドキュメントに残す。

## CI（GitHub Actions） — 既存 `ci.yml` を改修

旧 TrendScope 用のジョブ（embedding / sqlfluff / docker-build(embedding) / pr-security の一部）は削除・置換する。新しいジョブ:

| job | 内容 |
|---|---|
| `lint` | `pnpm install` → `pnpm lint`（eslint）→ `pnpm format:check`（prettier） |
| `typecheck` | `pnpm typecheck`（`tsc -b`。`apps/*` `packages/*` を references に登録） |
| `test-api` | Testcontainers で postgres 起動 → `pnpm --filter api test` |
| `test-web` | `pnpm --filter web test`（Vitest） |
| `e2e` | compose 起動 → migration → `pnpm --filter web e2e`（Playwright）。重いので main への push と手動トリガーのみでも可 |
| `build-images` | `apps/api` / `apps/web` の Docker build（push はしない） |
| `pr-security` | `.claude/scripts/pr-validate.py`（プロンプトインジェクション検査）は維持 |

- `codeql.yml`：matrix を `python` → `javascript-typescript` に変更。
- 段階的でよい：Sprint 1 は `lint` + `typecheck` + `test-api` + `test-web` を通す。`e2e` / `build-images` は器ができてから足す。

## 依存更新（Renovate / Dependabot）

**「なぜ古くなったか」への答えは「更新の仕組みを持っていなかったから」**。本線を最新に追随させる（[02_tech_stack.md](02_tech_stack.md)）以上、更新運用そのものを学習項目として組み込む。

- **Renovate（or Dependabot）を入れる**。設定 1 ファイル（`renovate.json` / `.github/dependabot.yml`）。
- 週次で PR が飛んでくる → **自分で changelog を読み、CI を見て、マージする**。この往復が本体。
- 運用ルールを自分で決めて書き残す。目安:
  - patch / minor → CI が緑なら自動マージ
  - major → 手動レビュー必須（changelog を読む）
  - **Drizzle は 1.0 未満なので minor も手動扱い**
- **これは「CI があると安全に上げられる」を体感する装置でもある**。テストを書く動機がここで繋がる。
- 学習トピック: semver の実際、lockfile と `--frozen-lockfile`、更新 PR のレビュー観点、まとめて上げる vs 1 つずつ

## ログ

- api: 1 リクエスト 1 行の構造化ログ（メソッド / パス / ステータス / ms / requestId）。`console` でよい（学習用）。**body・秘密は出さない**。
- エラーは stack をログに、レスポンスには出さない。
- 将来 `pino` + JSON ログ + 集約、は発展課題。

## 環境変数

- `.env`（gitignore）/ `.env.example`（コミット、ダミー値）。
- api は `lib/config.ts` で zod 検証して起動時に確定。
- キー一覧は [03_architecture.md](03_architecture.md) の「設定」節。

## pre-commit（既存 `.pre-commit-config.yaml` を調整）

- 維持: whitespace / end-of-file / check-yaml/json / merge-conflict / 大ファイル / detect-private-key / gitleaks / prettier / eslint / commitlint / prompt-injection-scan。
- 削除: ruff（embedding）/ sqlfluff（`infra/db`。Drizzle 生成 SQL に lint をかけたければ後で別途検討）。

## 学習トピック

- コンテナのマルチステージビルドとレイヤキャッシュ
- `depends_on` / ヘルスチェック / 起動順序
- migration をいつ・どこで流すか（起動時 vs パイプライン）
- 環境変数と秘密管理（`.env` / Secret / gitleaks）
- CI のジョブ分割と並列、キャッシュ（pnpm store / Docker layer）
- ヘルスチェックエンドポイントの設計（liveness / readiness）
- ログの構造化と「出してはいけないもの」
