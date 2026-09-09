# 10. コーディング規約との対応

規約の**正**は [`docs/conventions/`](../docs/conventions/README.md)。ここでは重複を書かず、対応だけ示す。

| このプロジェクトの層 | 規約ドキュメント | 強制ツール |
|---|---|---|
| `apps/api`（Hono / Node）、`packages/*` | [typescript.md](../docs/conventions/typescript.md) | ESLint(type-aware) + Prettier + tsc |
| `apps/web`（React） | [react.md](../docs/conventions/react.md) | ESLint(react/hooks/jsx-a11y) + Prettier + tsc |
| `packages/db` の migration / 生 SQL | [sql.md](../docs/conventions/sql.md) | （sqlfluff は一旦外す。Drizzle 生成物の lint は要検討） |
| （当面なし）Python / ML | [python.md](../docs/conventions/python.md) | ruff + mypy + pytest |
| 全ファイル | [README.md](../docs/conventions/README.md) の共通 8 原則 | pre-commit / EditorConfig |

## 既存規約の TrendScope 依存について

`docs/conventions/*.md` には旧 `design/01`〜`14` へのリンクや TrendScope 固有の例（`SpikeItem`、`DayStat`、トレンド可視化 等）が残っている。**内容の原則は有効**なので、リンク切れと題材例だけを追って直す（別 PR）。直すときの置き換え目安:

| 旧参照 | 新参照 |
|---|---|
| `design/02_architecture.md` | `design/03_architecture.md` |
| `design/04_security_multitenant.md`（境界の定義） | `design/05_api.md` + `design/06_auth.md` |
| `design/13_testing_strategy.md` | `design/08_infra_ops.md` の「テスト」+ 各層ドキュメントのテスト節 |
| `design/sprint1/refs/aggregate.ref.ts` | （削除済み。参照実装は必要になったら新規に） |
| 題材例（Spike/Trend/Detection） | 本プロジェクトの題材（User/Session/AuditLog 等） |

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
