# 09. 画面 / パターン カタログ（増やす台帳）

器ができた後、ここから 1 つ選んで作る。**作りたい画面・練習したいパターンをどんどん追記する**のがこのファイルの役目。

## 追加の手順（毎回これ）

1. この表に行を足す（画面名 / 練習するパターン / 必要な DB・API）。
2. DB が要るなら `packages/db/src/schema/` にテーブル追加 → migration 生成・レビュー・適用（[04_database.md](04_database.md)）。
3. API が要るなら `apps/api/src/routes/` にルータ追加 + `db/` にクエリ関数 + `packages/shared` に DTO（[05_api.md](05_api.md)）。
4. `apps/web/src/screens/<Name>/` を作り、`screens/registry.ts` に 1 エントリ追加（[07_frontend.md](07_frontend.md)）。
5. テスト（API はルータ + クエリ、web は hooks + 主要コンポーネント、必要なら E2E 1 本）。
6. 1 PR にまとめる。`patternTags` を registry に入れて「何を練習したか」を記録。

## Sprint 1 で作る（器 + 最初の縦切り）

| 画面 | 練習パターン | DB | API |
|---|---|---|---|
| ログイン | フォーム / 認証 / リダイレクト | users, sessions | `POST /auth/login`, `/logout`, `GET /auth/me` |
| ダッシュボードのシェル | レイアウトシェル / ナビ / 認可フィルタ / Outlet | — | — |
| 画面カタログ `/catalog` | レジストリの map / タグ表示 | — | — |

## 候補（着手順は自由。難度は目安）

| # | 画面 | 練習パターン | 追加 DB | 難度 |
|---|---|---|---|---|
| 1 | ユーザー一覧 | 一覧 UI / ページング(OFFSET) / 検索 / ソート / 空・エラー・ローディング | （users で足りる） | 易 |
| 2 | ユーザー詳細・編集 | 詳細取得 / フォーム編集 / 楽観更新なしの更新 / dirty 警告 | — | 易 |
| 3 | ユーザー作成 / 削除 | 作成フォーム / 確認ダイアログ / 楽観更新（削除） / 認可（admin 限定） | — | 中 |
| 4 | ロール・権限管理 | 多対多 / チェックボックス群 / 一括更新 | roles, permissions, role_permissions | 中 |
| 5 | 監査ログ | 読み取り専用大量データ / キーセットページング / 複合フィルタ / CSV エクスポート | audit_logs | 中 |
| 6 | 設定画面 | タブ / セクション別フォーム / 楽観更新 / トースト | settings（key-value or JSONB） | 中 |
| 7 | ダッシュボードのウィジェット | 集計クエリ / 複数 useQuery の並行 / 数値カード + グラフ | （既存表の集計） | 中 |
| 8 | 通知・お知らせ | 一覧 + 既読管理 / ポーリング or SSE / バッジ | notifications | 中 |
| 9 | ファイルアップロード | multipart / プレビュー / 進捗 / サーバ保存（ローカル FS or S3 互換 MinIO） | files | 中〜難 |
| 10 | 全文検索 | Postgres `tsvector` / GIN index / ハイライト / ランキング | （対象表に検索列） | 難 |
| 11 | リアルタイム更新 | WebSocket or SSE / 楽観更新との整合 / 再接続 | — | 難 |
| 12 | インポート（CSV 一括） | ストリーム処理 / バリデーション集計 / 部分失敗の扱い / ジョブ化 | import_jobs | 難 |
| 13 | 非同期ジョブ | キュー（軽量: DB ポーリング / BullMQ+Redis）/ 進捗表示 / 冪等性 | jobs | 難 |
| 14 | 権限つき共有リンク | 署名付き URL / 有効期限 / スコープ | share_links | 中 |
| 15 | 監視ダッシュボード | `/health` 集約 / メトリクス / アラート閾値 | — | 中 |
| 16 | **リクエストログ** | 記録 middleware / 大量 append-only / キーセットページング / 複合フィルタ | request_logs | 易 |

**#16 は [11_bot_detection.md](11_bot_detection.md) の「段 0」**。テーブル・シグナルの型・ルールの型（中身は空）・一覧画面だけを作り、**検知ロジックは後から `rules` 配列に足すだけ**で増える形にしておく。優先度は高く、**#1 ユーザー一覧より先でもよい** —— 放っておいてもデータが数万行溜まるので、ページング・インデックス・`EXPLAIN` の練習に本物のデータ量を供給してくれる。検知そのものの段 1〜4 は 11 章で育てる。

## デザインパターン単体で練習したいもの（画面に紐付けず）

`screens/patterns/<name>/` に置いてカタログに `patternTags: ["pattern-only"]` で載せる。

- モーダル / ダイアログ（Radix Dialog、フォーカストラップ、スクロールロック）
- トースト通知
- 無限スクロール（`useInfiniteQuery`）
- 楽観更新とロールバック
- Compound Components（`<Tabs><Tabs.List>...`）
- Render Props / Headless コンポーネント
- Error Boundary と Suspense
- デバウンス検索
- テーブルの列リサイズ / 固定ヘッダ / 行選択
- 仮想スクロール（大量行）
- ドラッグ＆ドロップ並び替え
- キーボードショートカット
- 国際化（i18n）の骨組み
- テーマ切替（light/dark、`class` 戦略）
- フォームウィザード（複数ステップ + 途中保存）

## 発展 = 隔離ラボ（`labs/`）

**「別の選択肢との比較」は本線を汚さず `labs/` に置く**（[03_architecture.md](03_architecture.md) / [02_tech_stack.md](02_tech_stack.md)）。本線 CI・workspace・`references` の対象外。壊れていても本線が緑なら OK。

| ラボ | 内容 | 時期 |
|---|---|---|
| `labs/prisma-compare/` | 同じスキーマを Prisma で定義し、生成 SQL と DX を Drizzle と比較 | いつでも |
| `labs/traffic-gen/` | 自分の bot 検知器を自分で叩く（[11_bot_detection.md](11_bot_detection.md)） | #16 の後 |
| `labs/next-app/` | 同じアプリを **Next.js（App Router）** で作り直し、RSC / Server Actions / キャッシュを比較 | React が body に入った後 |
| `labs/trpc/` | API を **tRPC** に載せ替えて「HTTP を隠す」開発体験を比較 | 同上 |
| `labs/auth-managed/` | 認証を **Lucia / Auth.js** に載せ替えて自前実装と比較 | 同上 |
| `labs/k8s/` | **Kubernetes**（kind / minikube）にデプロイ。Deployment / Service / Ingress / ConfigMap / Secret | 同上 |
| `labs/observability/` | 監視（Prometheus + Grafana）、構造化ログ集約 | 同上 |

**ラボに置かないもの**：古いバージョンの作法。それは隔離ではなく単に捨てる（[02_tech_stack.md](02_tech_stack.md) の「バージョン方針」）。
