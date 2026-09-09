# コーディング規約・レビュー基準

各技術スタックの「書き方の正」。**コードレビューの基準**であり、同時に**実務スタイルの学習リファレンス**として読めるよう、ルールだけでなく *なぜそうするか（WHY）* を併記する。

> 設計の正は [`design/`](../../design/README.md)、AI への作業ルールは各 `CLAUDE.md`。本ディレクトリは**人間がコードを書く / レビューするときの基準**を担う。三者が食い違ったら design → 本規約 → コード の順で正とする。

## スタック別ドキュメント

| ドキュメント | 対象 | 自動強制ツール |
|---|---|---|
| [typescript.md](typescript.md) | Node.js + TypeScript（`apps/api` / `packages/*`） | ESLint（type-aware）+ Prettier + tsc |
| [react.md](react.md) | React + TypeScript（`apps/web`） | ESLint（react / react-hooks）+ Prettier + tsc |
| [sql.md](sql.md) | PostgreSQL（`packages/db` の Drizzle 生成 migration と生 SQL） | migration テスト（Testcontainers） |
| [python.md](python.md) | Python（**当面このプロジェクトには無い**。将来 Python を足すときの基準として保存） | ruff + mypy --strict + pytest |

コミット規約・ブランチ戦略・PR の出し方は重複させない。[`CONTRIBUTING.md`](../../CONTRIBUTING.md) を参照（Conventional Commits は commitlint が commit-msg で強制）。テスト方針は各層の設計書のテスト節（[`04_database`](../../design/04_database.md) / [`05_api`](../../design/05_api.md) / [`07_frontend`](../../design/07_frontend.md)）と [`08_infra_ops.md`](../../design/08_infra_ops.md) が正。

## 使い方

**書くとき**: 着手前に対象スタックの章へ目を通す。迷ったら「定義順」「コメント」「禁止事項」「レビューチェックリスト」の4節だけでも見る。

**レビューするとき**: 各章末の **レビューチェックリスト** をそのまま観点に使う。指摘は「規約のどの項目に反するか」を添える（例: 「typescript.md の『エラーは型で握る』に反する」）。**実際の修正につながる substantive な指摘のみ**報告する（スタイルは下記ツールが機械的に直すので、人間は設計・正しさ・安全に集中する）。

**詰まったら**: ルールの理由が腑に落ちないものは飛ばさず、WHY 節を読む。それでも納得できない／現実に合わないルールは、勝手に破らず PR か Issue で「この規約はこのケースに合わない」と提起する（規約も更新対象）。

## 全スタック共通の原則

スタックを問わず効く土台。各章はこれを言語ごとに具体化したもの。

1. **境界で検証し、内側は信頼する。** 検証は信頼境界（ユーザー入力・外部 API・他サービスからの応答）で一度だけ行う。内部関数で同じチェックを重ねない。境界の定義は [`design/05_api.md`](../../design/05_api.md)（API の入口で zod `parse`）と [`design/03_architecture.md`](../../design/03_architecture.md)（`packages/shared` が境界の契約）。
2. **名前は意図を表す。** 型・関数・変数の名前が役割を説明する。`data` / `tmp` / `do()` のような名前は、それが本当に「任意のデータ」でない限り使わない。
3. **定義順は「読む順」に従える。** 公開 API（型・エクスポート）を上、補助を下。呼ぶ前に定義を探して上下にスクロールさせない。詳細は各章の定義順節。
4. **コメントは WHY を書く。** *何をしているか* はコードが語る。コメントは *なぜこうしたか*（制約・回避策・微妙な不変条件・トレードオフ）を書く。自明なコメントは書かない。
5. **エラーは握り潰さない。** 握れない例外は伝播させる。握るなら理由をコメントし、握った事実をログか戻り値で表す。「起きえない」分岐の防御コードは書かない。
6. **テストは完了の定義の一部。** 機能を「書いてから足す」のでなく、PR の完了条件にテストを含める（各 `design/sprint*/day*.md` の「完了確認」がその日の定義）。
7. **秘密はコード・ログに出さない。** セッション ID・トークン・パスワードハッシュ・バインド済み SQL の値を出力しない。秘密は `.env`（gitignore）に置き、`lib/config.ts` で起動時に zod 検証する（[`design/06_auth.md`](../../design/06_auth.md) / [`design/08_infra_ops.md`](../../design/08_infra_ops.md)）。
8. **三つの重複 > 早すぎる抽象化。** 似た3行が出たら即共通化しない。抽象化は「変更理由が同じ」と確信できてから。

## ツールと規約の対応

規約は「人が守る」と「ツールが強制する」に分かれる。**機械が守れるものは機械に任せ、レビューは人にしか見えない設計・正しさ・安全に使う。**

| 規約の種類 | 強制方法 | 例 |
|---|---|---|
| 整形（インデント・引用符・改行・import 順） | 自動修正（Prettier / `eslint --fix`） | レビューで指摘しない。`pnpm format` で直る |
| 静的な誤り（未使用・floating promise・`any`・型不一致） | CI で fail（ESLint type-aware / tsc） | PR がマージ前に止まる |
| 設計・命名・定義順・コメントの質 | 人のレビュー（本規約のチェックリスト） | substantive な指摘のみ |
| 安全境界（認可・SQL・Cookie・秘密） | テスト（[`design/05_api.md`](../../design/05_api.md) / [`design/06_auth.md`](../../design/06_auth.md)）+ 人のレビュー | 認可マトリクス（member が admin API で 403）は CI 必須通過 |

ツールの導入・設定は [TOOLING.md](TOOLING.md) を参照（`.editorconfig` / ESLint / Prettier / pre-commit / CI / VS Code の対応関係）。
