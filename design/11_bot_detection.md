# 11. Bot 検知（独立テーマ）

> ステータス: **段 0（インターフェイスのみ）を Sprint 2 で入れる。段 1 以降は後から埋める。**
> 09 のカタログには「#16 リクエストログ」だけを置き、検知の中身はこの章で育てる。

## なぜやるか

- **実務に直結**：スクレイピング・情報収集が本業なら「なぜブロックされるか」を知る必要がある。**検知する側を作るのが最短**で、防御側を組むと攻撃側のシグナルが構造的に分かる。
- **他の学習項目に必然性を与える**：リクエストログは放っておいても数万行溜まる。ユーザー 10 件では体感できないインデックス設計・`EXPLAIN`・キーセットページング・時系列集計（[04_database.md](04_database.md) の学習トピック）が、初めて意味を持つ。
- **層を横断する**：middleware（BE）/ 大量 append-only（DB）/ ダッシュボード（FE）/ レート制限（INFRA）。1 テーマで全層を踏める。

## 前提と境界

- 対象は**自分のローカルサービスのみ**。検知器も、それを叩く側（`labs/traffic-gen/`）も自分のもの。
- 収集するのは自分宛のリクエストのメタデータだけ。第三者のサイトには何もしない。
- **IP は生で保存しない**（`ipHash = sha256(ip + salt)`）。保持期間を決めて期限切れを消す。個人情報の扱いを決めること自体が学習項目。

---

## 段階

| 段 | 内容 | 状態 |
|---|---|---|
| **0** | **インターフェイス**：`request_logs` テーブル + 記録 middleware + 一覧画面。ルールは 0 個、スコアは常に 0 | **Sprint 2 で作る** |
| 1 | ルールベース検知：レート制限 / UA ヒューリスティック / ハニーポット | 後日 |
| 2 | フィンガープリント：HTTP ヘッダ順、ブラウザ側の canvas / WebGL / フォント | 後日 |
| 3 | 行動分析：マウス移動・入力速度・遷移パターン | 後日 |
| 4 | 対応の設計：監視 → レート制限 → チャレンジ → ブロックの梯子 | 後日 |

**段 0 の目的は「後から段 1〜4 を足すときに作り直しが発生しない継ぎ目を作ること」**。中身は空でいい。

---

## 段 0：固めておく継ぎ目

### シグナルの型

```
// packages/shared/src/detection.ts（形のイメージ。実装はオーナー）
export interface RequestSignals {
  requestId: string;
  at: Date;
  ipHash: string;              // 生 IP は保存しない
  method: string;
  path: string;
  status: number;
  durationMs: number;
  userAgent: string | null;
  acceptLanguage: string | null;
  acceptEncoding: string | null;
  headerNames: string[];       // **順序を保つ**（段 2 のフィンガープリントで使う）
  referer: string | null;
}
```

`headerNames` は段 0 では表示しかしないが、**後から採り直せないので最初から記録する**。これが「継ぎ目」の意味。

### ルールの型（中身は後で）

```
export interface RuleHit { score: number; reason: string }

export interface DetectionRule {
  id: string;                                  // "ua-missing", "rate-burst", ...
  enabled: boolean;
  evaluate(s: RequestSignals): RuleHit | null; // null = 該当なし
}

export interface DetectionVerdict {
  score: number;      // 0..100
  reasons: string[];  // 効いたルールの id
}
```

パイプラインの継ぎ目：

```
middleware → collectSignals(c) → evaluate(signals, rules) → request_logs に INSERT
```

**段 0 では `rules: DetectionRule[] = []`**。`evaluate` は常に `{ score: 0, reasons: [] }` を返す。
段 1 以降は**この配列に 1 個足すだけ**で検知が増える（[07_frontend.md](07_frontend.md) の画面レジストリと同じ発想）。

### テーブル（段 0）

`request_logs`

| カラム | 型 | 備考 |
|---|---|---|
| id | bigint identity | 連番でよい（append-only、キーセットページングの軸） |
| at | timestamptz NOT NULL default now() | |
| ip_hash | text NOT NULL | 生 IP は入れない |
| method / path / status | text / text / int | すべて NOT NULL |
| duration_ms | int NOT NULL | |
| user_agent / accept_language / accept_encoding / referer | text | null 可（**無いこと自体がシグナル**） |
| header_names | text[] NOT NULL | 順序を保つ |
| bot_score | int NOT NULL default 0 | **段 0 では常に 0。列は最初から用意する** |
| bot_reasons | text[] NOT NULL default '{}' | 同上 |

- index: `(at desc, id desc)`（キーセットページング）、`(ip_hash, at desc)`（段 1 のレート判定）。
- `bot_score` / `bot_reasons` を最初から置くのは、**行が数万〜数十万に育った後の `ALTER TABLE` を避ける**ため。「大きくなってからスキーマを変える痛み」は学習トピックとしては別途 `labs/` で味わう。
- 保持期間（例: 30 日）を決め、期限切れ削除を後で [09](09_screen_catalog.md) #13 の非同期ジョブの題材にする。

### 画面（段 0）

09 の **#16 リクエストログ** 1 枚だけ。`bot_score` 列は常に 0 で表示しておく（後で埋まる場所を先に見せる）。

---

## 段 1 以降のメモ（着手時に詳細化）

### 段 1: ルールベース

- **レート制限**：sliding window / token bucket。同一 `ip_hash` の秒間・分間リクエスト数。
- **UA ヒューリスティック**：既知 bot UA / UA なし / **UA と `Accept-*` ヘッダの矛盾**（ブラウザを名乗るのに `Accept-Language` が無い等）。
- **ハニーポット**：CSS で隠したリンクとフォーム欄。人間には見えないので、踏んだら bot 確定。**誤検知がほぼゼロの数少ないシグナル**。
- 学習の核心：**誤検知(false positive)のコスト**と閾値設計。

### 段 2: フィンガープリント

- サーバ側：ヘッダの**順序**と組み合わせ。HTTP/2 の SETTINGS フレーム順（概念のみ）。
- クライアント側：canvas / WebGL / フォント / 画面サイズ → ハッシュ化。同意 UI も作る。
- **この段の学習の核心**：サーバ側シグナルは偽装しにくく、クライアント側は偽装しやすい。**信頼の階層**があること。
- TLS フィンガープリント（JA3/JA4）は Node の手前に層が要るので**概念の説明に留める**（Caddy を前に置く回を作るなら実装可）。

### 段 3: 行動分析

- マウス移動 / キー入力間隔 / フォーム入力速度 → 人間らしさスコア。
- 遷移パターン（人間は迷う、bot は最短距離）。
- 統計的な閾値の置き方、ROC 的な考え方。

### 段 4: 対応の梯子

- **監視 → レート制限 → チャレンジ → ブロック**。段階を踏む。
- **なぜ即ブロックしないか**：誤検知のコストと、**検知ロジックを攻撃者に教えてしまう**こと。
- shadow mode（判定するが何もしない）でルールを検証してから有効化する運用。tarpitting の概念。

---

## 叩く側：`labs/traffic-gen/`

検知器を作ってもトラフィックが無ければ何も検知しない。**攻撃側も防御側も自分**、対象は自分の `localhost` のみ。

- 素の `fetch` / `curl` / Playwright（headless / headful）/ UA 偽装ありなし で叩き分ける。
- **同じリクエストがシグナル上どう違って見えるか**を `request_logs` で観察する。
- 自分の検知器を自分で突破しようとして、どのシグナルが効いているかを確かめる。
- 「Playwright の headless はどこで見破られるか」を自分の検知器で確認する経験が、そのまま実務の勘所になる。

本線 CI からは外す（[03_architecture.md](03_architecture.md) の `labs/` 方針）。

---

## 学習トピック

- append-only テーブルの設計とインデックス（`EXPLAIN` を読む）
- キーセットページングが OFFSET より効く条件
- 時系列集計（`date_trunc` / window 関数）
- middleware でのシグナル収集と、リクエストを遅くしない書き方
- 個人情報（IP）のハッシュ化・保持期間・削除
- 誤検知と見逃しのトレードオフ、閾値の決め方
- shadow mode によるルールの安全な投入
- 「検知される側」から見たときに、どのシグナルが偽装しやすいか
