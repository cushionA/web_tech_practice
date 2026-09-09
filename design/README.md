# 設計ドキュメント — フルスタック学習台

このディレクトリは「作るもの」の**正**。コードと食い違ったらここを見て、必要なら設計を直してからコードを直す。

## これは何か

Web エンジニアとしての**土台知識**（DB → API → フロント → インフラ運用）を、一気通貫で組んで身につけるための学習用プロジェクト。ポートフォリオでも納品物でもない。転職先（スクレイピング・情報収集の会社）の実務と地続きな構成を選んでいる。

- **器**（ログイン・ダッシュボードのシェル・画面レジストリ）は最初に一度組む
- **練習場**（画面 1 つ = 1 デザインパターン / 実装パターン）は後からいくらでも足せる作り。例：あとから管理画面やダッシュボードなどを作りたくなったら付け足せる
- 器と練習場のコードは**オーナー本人が手を動かす**。このドキュメント群と各 `dayX.md` 指示書がその足場

## ドキュメント一覧

| ファイル | 内容 |
|---|---|
| [01_goals_and_scope.md](01_goals_and_scope.md) | 学習ゴール・非ゴール・進め方 |
| [02_tech_stack.md](02_tech_stack.md) | 技術選定と WHY（Hono / PostgreSQL / Drizzle / React / Docker） |
| [03_architecture.md](03_architecture.md) | monorepo 構成・レイヤ・データフロー・環境 |
| [04_database.md](04_database.md) | スキーマ設計方針・migration 運用・シード |
| [05_api.md](05_api.md) | API 設計（ルーティング・バリデーション・エラー・認証） |
| [06_auth.md](06_auth.md) | ダミー認証 → セッション/JWT の学習ステップ |
| [07_frontend.md](07_frontend.md) | 器・画面レジストリ・ルーティング・API クライアント |
| [08_infra_ops.md](08_infra_ops.md) | Docker Compose・migration 運用・CI/CD・ログ・ヘルスチェック |
| [09_screen_catalog.md](09_screen_catalog.md) | 追加していく画面 / パターンの候補リスト（増やす台帳） |
| [10_conventions_pointer.md](10_conventions_pointer.md) | `docs/conventions/` との対応（重複させない） |
| [11_bot_detection.md](11_bot_detection.md) | Bot 検知（独立テーマ）。段 0＝インターフェイスのみを先に作り、検知の中身は後から足す |

## Sprint

| ファイル | 内容 |
|---|---|
| [sprint1_plan.md](sprint1_plan.md) | Sprint 1 全体マップ（土台の縦切り: DB → API → 認証 → フロントの器。全 7 回） |
| `sprint1/dayX.md` | 各回の作業指示書（全 7 回。1 タスク = 1 PR。目的 / 前提 / 手順 / 完了確認 / 詰まったら） |
| [../notes/react_basics.md](../notes/react_basics.md) | **Day 5 の前にやる素振り**。props / state / 再レンダリング / effect / フォーム / context |

## 進め方の原則

- **下から組む**: スキーマ → migration → API → 認証 → フロントの器、の順。各層が動いてから次へ。
- **1 縦切りを最初に通す**: 「ログインできてダッシュボードのシェルが出る」までを Sprint 1 で貫通させる。横に広げるのはその後。
- **指示書は足場、答えではない**: `dayX.md` は目的・前提・つまづきどころ・完了条件を書く。実装コードは書かない（シグネチャとヒントまで）。
- **「日」ではなく「回」で数える**: `dayX.md` はカレンダーの 1 日ではない。1 回 2〜4 時間、詰まったら割ってよい。遅れを負債にしない。
- **設計を勝手に変えない**: techスタックや層の分け方を変えたくなったら、まずこのドキュメントを直して合意してからコードへ。
- **本線は最新に追随する**: 「古いバージョンを学ぶ」ことに価値はない。ただし「低いレイヤから積む」ことには価値がある（自前認証・素の HTTP・生 SQL）。この 2 つを混同しない（[02_tech_stack.md](02_tech_stack.md)）。
- **比較は `labs/` に隔離する**: Prisma / Next.js / tRPC などの「別の選択肢」は本線を汚さず `labs/` で。本線 CI の対象外（[09_screen_catalog.md](09_screen_catalog.md)）。
