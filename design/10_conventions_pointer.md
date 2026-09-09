# 10. コーディング規約との対応

規約の**正**は [`docs/conventions/`](../docs/conventions/README.md)。ここでは重複を書かず、対応だけ示す。

| このプロジェクトの層 | 規約ドキュメント | 強制ツール |
|---|---|---|
| `apps/api`（Hono / Node）、`packages/*` | [typescript.md](../docs/conventions/typescript.md) | ESLint(type-aware) + Prettier + tsc |
| `apps/web`（React） | [react.md](../docs/conventions/react.md) | ESLint(react/hooks/jsx-a11y) + Prettier + tsc |
| `packages/db` の migration / 生 SQL | [sql.md](../docs/conventions/sql.md) | （sqlfluff は外した。生成 SQL は人が読む + Testcontainers テスト） |
| （当面なし）Python | [python.md](../docs/conventions/python.md) | ruff + mypy + pytest（**休眠中**。足すときに pre-commit フックも戻す） |
| 全ファイル | [README.md](../docs/conventions/README.md) の共通 8 原則 | pre-commit / EditorConfig |

## 既存規約の TrendScope 依存について（解消済み）

`docs/conventions/*.md` には旧 `design/01`〜`14` へのリンクや TrendScope 固有の例が残っていたが、**リンク切れと題材例は解消済み**。原則は変えていない。適用した置き換え:

| 旧参照 | 新参照 |
|---|---|
| `design/02_architecture.md` | `design/03_architecture.md` / `design/02_tech_stack.md` |
| `design/03_db_schema.md` | `design/04_database.md` |
| `design/04_security_multitenant.md`（境界の定義） | `design/05_api.md` + `design/06_auth.md` |
| `design/13_testing_strategy.md` | 各層ドキュメントのテスト節 + `design/08_infra_ops.md` |
| `design/sprint1/refs/aggregate.ref.ts` | （削除済み。参照を落とした） |
| 題材例（Spike/Trend/Watchlist/Tenant） | 本プロジェクトの題材（User/Session/AuditLog/RequestLog） |
| `infra/db/migrations/*.sql`（手書き） | `packages/db/drizzle/*.sql`（Drizzle 生成） |
| `npm run *` / `make *.embedding` | `pnpm *` |

**方針の変更を伴った箇所**（原則の置き換えなので、リンク直し以上のことをした）:

- **sql.md**: 「手書き migration」前提 → **「schema(TS) が単一の正、SQL は生成物。読んで判断する」**前提へ。RLS 節は「このプロジェクトではやらない」に圧縮し、その役割（越境の恒久ガード）は **API 層の認可マトリクステスト**が引き継ぐと明記
- **python.md**: 冒頭に**休眠中**であることを明記。Embedding 固有節は「重いリソースを持つサービスの一般則」に一般化して保存
- **react.md**: 題材を管理コンソール（`Field` / `UserTable` / `DashboardShell`）に。画面レジストリと「サーバ状態は TanStack Query」を追記
- **TOOLING.md**: `apps/web` を `references` に入れない理由と `pnpm build` が要る理由（内部パッケージの解決）を追記

## コミット / ブランチ / PR

[`CONTRIBUTING.md`](../CONTRIBUTING.md) が正（Conventional Commits は commitlint が commit-msg で強制）。このドキュメント群では繰り返さない。

## AI への作業ルール

ルート [`CLAUDE.md`](../CLAUDE.md) が正。TrendScope 記述が残っているので、このピボットに合わせて書き直す（Sprint 1 Day 1 のタスクに含める）。

## 委譲方針（[自分] / [AI]）

このプロジェクトは**学習が目的**。器・練習場・追加画面の**実装コードはオーナー本人が書く**（[README.md](README.md)）。

| 種別 | 担当 |
|---|---|
| スキーマ設計・API インターフェース・認証ロジック・型定義の骨子 | **[自分]**（面接で説明できる必要があるもの = 必ず自分） |
| 画面・コンポーネント・hooks・ルーティング・フォームの実装 | **[自分]**（React を手で覚えるのが目的） |
| migration SQL / Dockerfile / compose / CI YAML の一次案 | **[自分]** がレビューできる形で書く。詰まったら [AI] が雛形提示 |
| 定型の複製（2 個目以降の似た CRUD 画面・テストの横展開） | [AI] に投げてよい（1 個目を自分で作った後） |
| 設計ドキュメント・Day 指示書・レビュー・詰まりの解消 | [AI] |

- 迷ったら **[自分]** に倒す。
- Day 指示書の [自分] タスクは「目的 / 前提 / つまづきどころ / 完了条件」を書き、**実装コードは書かない**（シグネチャとヒントまで）。
- 層ラベル（`[FE]` / `[BE]` / `[INFRA]` / `[TEST]` / `[設計]`）を委譲タグの後ろに併記し、日ごとの偏り（特に `[INFRA]` `[TEST]` のゼロ続き）を避ける。
