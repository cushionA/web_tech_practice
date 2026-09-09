# Sprint 1 Day 1 作業指示書

> テーマ: monorepo 化と足場づくり
> 完了時の状態: `pnpm install` が通り、`apps/{api,web}` `packages/{db,shared}` の空パッケージが `pnpm typecheck` を通る。`CLAUDE.md` / ルート `README.md` が本ピボットを反映。CI が新構成で緑。
> 推定所要: 2〜3 時間
> 主に踏む層: `[INFRA]` `[設計]`

参照: [design/03_architecture.md](../03_architecture.md)（構成）/ [design/02_tech_stack.md](../02_tech_stack.md)（なぜ pnpm）/ [docs/conventions/TOOLING.md](../../docs/conventions/TOOLING.md)（既存ツール母艦）

---

## Day1-1. 前提確認 [自分] [INFRA]

**目的**
Day 1 以降が前提にする道具が揃っているかを最初に潰す。ここで固めておくと後の「動かない」の切り分けが楽になる。

**前提確認**
- [ ] `node -v` が **Active LTS**（`.nvmrc` を置いてもよい。ルート `package.json` の `engines.node` もこれに合わせて更新する）
- [ ] `pnpm -v` が出る（無ければ `corepack enable` → `corepack prepare pnpm@latest --activate`）
- [ ] `docker version` と `docker compose version` が出る（Docker Desktop が起動している）
- [ ] `git branch --show-current` が `pivot/react-learning`
- [ ] `git status` がクリーン（設計ドキュメントのコミットは済ませておく）

**バージョンの確定（5 分）**
[02_tech_stack.md](../02_tech_stack.md) の方針は「本線は最新安定版」。着手時点の最新を自分で確認して決める。特に **Zod だけは周辺の対応版を揃える必要がある**ので、ここで潰しておく。

- [ ] React / React Router / Tailwind / Vite / Node / PostgreSQL の最新安定版を確認した
- [ ] **Zod のメジャーを決めた**。`@hookform/resolvers`（Day 5）・`drizzle-zod`（Day 2）・`@hono/zod-openapi`（使うなら）の 3 つが**そのメジャーに対応しているか**を確認 → 揃わなければ 1 つ前で始めて後日上げる
- [ ] Tailwind は **v4 前提**で Day 5 の手順が書かれている（v3 の記事に引きずられないこと）
- [ ] Drizzle は **1.0 未満**なので完全固定（`^` を付けない）

**完了確認**
- [ ] 上記すべて OK
- [ ] `git log --oneline -3` に旧資産削除コミット（`chore: remove TrendScope ...`）が見える

**詰まったら**
- pnpm が古い → `corepack prepare pnpm@latest --activate`
- Docker が `permission denied`（WSL） → Docker Desktop の WSL integration を有効化

---

## Day1-2. pnpm workspace 化 [自分] [INFRA]

**目的**
ルートの `package.json` は既に「TS ツール母艦」として存在する（[TOOLING.md](../../docs/conventions/TOOLING.md)）。これを pnpm workspace のルートに格上げし、`apps/*` `packages/*` を配下に置ける形にする。「モノレポとは何をしている構成か」を手で作って理解する。

**自分で書く理由**
workspace の切り方（どこを 1 パッケージにするか、内部参照をどう張るか）は設計判断。面接で「なぜ monorepo に、なぜ pnpm に」を語れる必要がある。

**前提確認**
- [ ] ルート `package.json` の `name` が `trendscope`（後で変える）
- [ ] ルートに `node_modules` があるなら一度 `rm -rf node_modules pnpm-lock.yaml package-lock.json`（npm の lockfile は捨てて pnpm に一本化）

**手順**
1. `pnpm-workspace.yaml` をルートに作成:
   ```yaml
   packages:
     - "apps/*"
     - "packages/*"
   ```
2. `.npmrc` をルートに作成（厳格さの学習も兼ねる。最低限）:
   ```
   engine-strict=true
   ```
3. ルート `package.json` を調整:
   - `name` を `portfolio-fullstack-learning`（任意）に
   - `"packageManager": "pnpm@<バージョン>"` を追加
   - `scripts` を pnpm 前提に（`lint`/`format`/`typecheck` は既存のまま、`-r` を使う横断スクリプトを足すのは後日でよい）
4. `pnpm install`（まだパッケージが無いのでルートの devDeps だけ入る）

**完了確認**
- [ ] `pnpm install` がエラーなく完了
- [ ] `pnpm-lock.yaml` が生成された（`package-lock.json` は消えている）
- [ ] `git status` に `pnpm-workspace.yaml` `.npmrc` `pnpm-lock.yaml` の変更が見える

**詰まったら**
- `engine-strict` で入らない → `package.json` の `engines.node` と手元の `node -v` が一致しているか確認（`engines` も Active LTS に更新すること）
- 既存 `node_modules` 由来の警告 → 一度消してから `pnpm install`

---

## Day1-3. 空パッケージ 4 つを作る [自分] [INFRA] [設計]

**目的**
`apps/api` `apps/web` `packages/db` `packages/shared` の 4 つを、中身は空でいいので「TS パッケージとして型検査が通る」状態にする。ルート `tsconfig.json` の `references` に登録して、`pnpm typecheck`（= `tsc -b`）が 4 パッケージを横断で見るようにする。

**自分で書く理由**
パッケージ境界＝アーキテクチャの骨。どこに何を置くか（[03_architecture.md](../03_architecture.md)）を自分の手で写経して頭に入れる。

**前提確認**
- [ ] [design/03_architecture.md](../03_architecture.md) の「monorepo 構成」に目を通した
- [ ] `tsconfig.base.json` / ルート `tsconfig.json` の中身を読んだ（[TOOLING.md](../../docs/conventions/TOOLING.md)）

**先に読む — ここが Day 1 の山場**
[03_architecture.md](../03_architecture.md) の**「内部パッケージの解決（決定事項）」**節。要点は 2 つ:

1. **`exports` はソース（`./src/index.ts`）ではなく `dist` を指す。** 混ぜると `tsc -b` が壊れる。
2. **`apps/web` だけ composite ではない**（`noEmit: true` と両立しないため）。ルート `references` に**入れない**。これは回避策ではなく正しい構成。

**手順**
1. `packages/shared` を作る:
   - `packages/shared/package.json`:
     ```json
     {
       "name": "@app/shared",
       "version": "0.0.0",
       "private": true,
       "type": "module",
       "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
       "scripts": { "build": "tsc -b", "dev": "tsc -b --watch", "typecheck": "tsc -b" }
     }
     ```
   - `packages/shared/tsconfig.json`:
     ```json
     { "extends": "../../tsconfig.base.json",
       "compilerOptions": { "outDir": "dist", "rootDir": "src" },
       "include": ["src"] }
     ```
     （`composite: true` は `tsconfig.base.json` から継承される）
   - `packages/shared/src/index.ts`: `export {};`（空 barrel）
   - `.gitignore` に `dist/` が入っているか確認（無ければ足す）
2. `packages/db` も同様（`name: "@app/db"`）。
3. `apps/api` も同様（`name: "@app/api"`）。加えて **自分が使う package を `references` に書く**:
   ```json
   { "extends": "../../tsconfig.base.json",
     "compilerOptions": { "outDir": "dist", "rootDir": "src" },
     "include": ["src"],
     "references": [
       { "path": "../../packages/shared" },
       { "path": "../../packages/db" }
     ] }
   ```
   `src/index.ts` は `export {};` 仮置き。
4. `apps/web` は React 用に上書き（[docs/conventions/react.md](../../docs/conventions/react.md)）。**`composite: false` + `noEmit: true`**:
   ```json
   { "extends": "../../tsconfig.base.json",
     "compilerOptions": {
       "lib": ["ES2022", "DOM", "DOM.Iterable"],
       "jsx": "react-jsx",
       "moduleResolution": "Bundler",
       "composite": false,
       "noEmit": true },
     "include": ["src"],
     "references": [{ "path": "../../packages/shared" }] }
   ```
   `apps/web/package.json` の `scripts` に `"typecheck": "tsc --noEmit"`（**`tsc -b` ではない**）。
   `apps/web/src/index.ts`: `export {};` 仮置き（Day 5 で本物に）。
5. 内部参照の宣言を入れる: `apps/api/package.json` の `dependencies` に
   `"@app/db": "workspace:*", "@app/shared": "workspace:*"`、`apps/web` に `"@app/shared": "workspace:*"`。
6. ルート `tsconfig.json` の `references` に **3 つだけ**追加（**web は入れない**）:
   ```json
   { "files": [],
     "references": [
       { "path": "packages/shared" },
       { "path": "packages/db" },
       { "path": "apps/api" }
     ] }
   ```
7. ルート `package.json` の `scripts` に横断ビルドを足す:
   `"build": "tsc -b"`, `"typecheck": "tsc -b && pnpm --filter @app/web typecheck"`
8. `pnpm install`（`workspace:*` がリンクされる）→ `pnpm build`。

**完了確認**
- [ ] `pnpm build` で `packages/shared/dist/index.js` と `index.d.ts` が生成される
- [ ] `pnpm typecheck` が緑（3 パッケージの `tsc -b` + web の `tsc --noEmit`）
- [ ] `pnpm lint` が緑
- [ ] `packages/shared/src/index.ts` に `export const x: number = "a";` と書くと **typecheck が赤**になる → 戻す（配線が効いている確認）
- [ ] `packages/shared/dist` を消して `pnpm --filter @app/api typecheck` すると、`tsc -b` が**自動で shared を build し直す**（references の効果を見る）

**詰まったら**
- `referenced project may not disable emit` → `apps/web` に `composite: false` を書いたか、ルート `references` から web を外したか
- `Cannot find module '@app/shared' or its corresponding type declarations` → **`dist` がまだ無い**。`pnpm build` を先に流す。これが「build が要る」構成の帰結（[03_architecture.md](../03_architecture.md)）
- `@app/shared` が解決されない → `pnpm install` を再実行。`workspace:*` の綴り確認
- `File is not listed within the file list of project` → `exports` がまだ `./src/index.ts` を指している。`dist` に直す

---

## Day1-4. CLAUDE.md / ルート README をピボットに合わせて刷新 [自分] [設計]

**目的**
ルート [`CLAUDE.md`](../../CLAUDE.md) と [`README.md`](../../README.md) は TrendScope（マルチテナント RAG SaaS）前提のまま。これを「フルスタック学習台」に書き換える。AI もこのファイルを読んで動くので、古いままだと毎回ズレる。

**自分で書く理由**
プロジェクトの憲法。何を作り何を作らないか（[01_goals_and_scope.md](../01_goals_and_scope.md)）を自分の言葉で書く。

**前提確認**
- [ ] [design/01_goals_and_scope.md](../01_goals_and_scope.md) と [design/README.md](../README.md) を読んだ
- [ ] 現 `CLAUDE.md` をざっと読んで「消すべき記述」（テナント境界・BYOK・Gemini・embedding 規約・design 12 章・sprint-plan/pair-start の前提）を把握した

**手順**
1. `CLAUDE.md` を書き換え:
   - プロジェクト説明を「フルスタック + インフラ運用の学習台」に
   - サブプロジェクト表を `apps/api` `apps/web` `packages/db` `packages/shared` `infra/` に
   - 横断ルールから「テナント境界 / BYOK / query|passage 規約」を削除
   - 「設計の正は `design/`」「規約は `docs/conventions/`」「実装はオーナーが書く」を明記
   - 主要コマンドを pnpm ベースに（`pnpm install` / `pnpm lint` / `pnpm typecheck` / `docker compose -f infra/compose.yaml up`）
   - Forbidden から Supabase / appsettings 等の C#・SaaS 前提を削除、「秘密をコミットしない」は残す
2. ルート `README.md` も同様に、プロジェクトの一段説明・セットアップ手順・`design/` へのリンクに差し替え。
3. `CONTRIBUTING.md` は Conventional Commits / ブランチ / PR の一般論なので**基本そのまま**。TrendScope 固有の記述があれば最小限だけ直す。

**完了確認**
- [ ] `grep -ri "trendscope\|tenant\|BYOK\|Gemini\|embedding" CLAUDE.md README.md` がヒットしない（または意図的な言及だけ）
- [ ] `pnpm lint` が緑（Markdown は対象外だが一応）
- [ ] 新しい `CLAUDE.md` を読んで、初見の人が「何を作るプロジェクトか」分かる

**詰まったら**
- どこまで消すか迷う → 「TrendScope でしか意味を持たない記述」は消す。「フルスタック一般で有効」な記述（レビュー観点・コミット規約・秘密管理）は残す。

---

## Day1-5. CI を新構成に改修 [自分] [INFRA]（雛形は [AI] 可）

**目的**
`ci.yml` を **pnpm + 新パッケージ向けに組み直す**。Sprint 1 の範囲では `lint` / `typecheck` が緑になれば十分（`test-api` は Day 3〜4、`test-web` は Day 6 で中身ができてから足す）。

> **削除済みディレクトリを参照していたジョブ（`embedding` / `sql`(sqlfluff) / `docker-build`）は、TrendScope 撤去 PR で既に除去済み。** 消したものの後始末は削除側の責任なので、ここには含まれない。**このタスクは「足す側」だけ**。

**自分で書く理由**
CI は「何を品質ゲートにするか」の宣言。自分で読める YAML にしておくと、後でジョブを足すのが怖くなくなる。

**前提確認**
- [ ] 現 `ci.yml` / `codeql.yml` を読んだ（[TOOLING.md](../../docs/conventions/TOOLING.md) の CI 節も）
- [ ] `ci.yml` に残っているのが `node` と `pr-security` の 2 ジョブだけであることを確認した
- [ ] Day1-2〜1-4 が終わっていて、ローカルで `pnpm lint && pnpm typecheck` が緑

**手順**
1. `ci.yml` の `node` job を編集:
   - **`npm ci` のままだと Day1-2 で lockfile を pnpm に切り替えた時点で壊れる。** ここが本題
   - pnpm 化:
     ```yaml
     - uses: pnpm/action-setup@v4
       with: { version: <pnpm バージョン> }
     - uses: actions/setup-node@v6
       with: { node-version: "<Active LTS>", cache: "pnpm" }
     - run: pnpm install --frozen-lockfile
     - run: pnpm format:check
     - run: pnpm lint
     - run: pnpm typecheck
     ```
   - `pr-security` job（`.claude/scripts/pr-validate.py`）は**そのまま維持**
2. `codeql.yml`：matrix の `language: [python]` を `language: [javascript-typescript]` に変更。
   - 今は Python が無いので「解析対象ゼロで pass」しているだけの状態。TS を解析するように切り替える
3. コミットして PR。CI が緑になることを確認。

**完了確認**
- [ ] PR の CI で `node`（lint + typecheck）と `pr-security` が緑
- [ ] `node` ジョブのログが `pnpm install --frozen-lockfile` を実行している（`npm ci` ではない）
- [ ] `codeql` が js-ts で走る（初回は時間がかかる。緑を確認）

**AI 依頼テンプレ**（雛形が欲しい場合）
```
.github/workflows/ci.yml を pnpm + monorepo 向けに書き換えたい。
- 現状: node と pr-security の 2 ジョブのみ（旧 Python/sqlfluff ジョブは撤去済み）
- node ジョブ: pnpm/action-setup@v4 → setup-node@v6(node は Active LTS, cache pnpm)
  → pnpm install --frozen-lockfile → pnpm format:check → pnpm lint → pnpm typecheck
- pr-security ジョブ(.claude/scripts/pr-validate.py)はそのまま残す
現在の ci.yml を貼るので、差分だけ提案して。
```

---

## Day1-6. Makefile と pre-commit の棚卸し [自分] [INFRA]

**目的**
`Makefile` と `.pre-commit-config.yaml` を新構成（pnpm / `apps` / `packages`）に合わせる。

> **削除済みディレクトリを参照していた設定（`embedding` 系ターゲット、`lint.sql`、ruff / sqlfluff フック、`workers` を含む glob）は、TrendScope 撤去 PR で既に除去済み。** **このタスクは「新構成に合わせる側」だけ**。

**自分で書く理由**
「どのコマンドが自分のプロジェクトの入口か」を決める作業。壊れた入口を放置すると、後で他人（と未来の自分）が最初に踏む。

**前提確認**
- [ ] `Makefile` を読んだ（残っているのは repo-wide / typescript / compose / security の 4 セクション）
- [ ] `.pre-commit-config.yaml` を読んだ（[08_infra_ops.md](../08_infra_ops.md) の pre-commit 節）
- [ ] `pre-commit install -t pre-commit -t commit-msg` 済み

**手順**
1. `Makefile`:
   - **まず判断: 残すか捨てるか。** pnpm scripts で足りるなら捨ててよい。**残すなら `CLAUDE.md` の主要コマンドと一致させる**（Day1-4）
   - 残す場合: `install.ts` / `lint.ts` / `format.ts` / `typecheck.ts` と `install-tooling` の `npm` を **`pnpm` に**
   - `test` ターゲットを**足し直す**（`pnpm -r test`）。TrendScope 撤去時に中身が無くなって消えている
   - `up` / `down` / `logs` / `ps` に **`-f infra/compose.yaml` を付ける**（現状は素の `docker compose` で、compose ファイルの場所を見ていない）。**Day2-2 で compose を作ってから**でよい
2. `.pre-commit-config.yaml`:
   - `npx --no-install` のままでよいか確認（pnpm でもルート `node_modules/.bin` は作られるので通るはず。通らなければ `pnpm exec` に）
   - `files:` が `^(apps|packages)/` になっているので、Day1-3 で作ったパッケージから発火するはず。**実際に発火するか確かめる**（下の完了確認）
   - 維持されているもの: whitespace / end-of-file / check-yaml/json / merge-conflict / 大ファイル / detect-private-key / gitleaks / prettier / eslint / commitlint / prompt-injection-scan

**完了確認**
- [ ] `make lint`（残す場合）または `pnpm lint` が緑
- [ ] `pre-commit run --all-files` が緑
- [ ] `apps/` 配下に故意に lint エラーを作ると pre-commit が止める → 戻す
- [ ] `Makefile` を捨てた場合、`CLAUDE.md` / `README.md` から `make` の記述が消えている

**詰まったら**
- `pre-commit` が古い hook を掴む → `pre-commit clean` → `pre-commit install --install-hooks`
- gitleaks が `.env.example` を叩く → ダミー値が本物っぽいと誤検知する。値を明らかなプレースホルダに

---

## Day 1 終了チェックリスト

- [ ] `pnpm install` が通り `pnpm-lock.yaml` がコミットされている
- [ ] `apps/api` `apps/web` `packages/db` `packages/shared` が存在する
- [ ] `pnpm build` で `packages/*/dist` が生成される
- [ ] `pnpm typecheck` が緑（`tsc -b` 3 パッケージ + web は `tsc --noEmit`。**web はルート `references` に入れない**）
- [ ] `pnpm lint` `pnpm format:check` が緑
- [ ] `CLAUDE.md` / `README.md` が本ピボットを反映
- [ ] `Makefile`（残す場合）が pnpm ベース / `.pre-commit-config.yaml` が新構成で動く（`pre-commit run --all-files` が緑）
- [ ] CI（`ci.yml` の node ジョブ + `pr-security` + `codeql`）が緑
- [ ] 各タスクを 1 PR ずつ、Conventional Commits でマージ（**`DayX-1` 前提確認と Day1-1 のバージョン確定は成果物が無いので PR 対象外**）

## Day 2 への引き継ぎメモ

- Day 2 は `infra/compose.yaml` で postgres を立て、`packages/db` に Drizzle を入れて `users`/`sessions` スキーマ + migration + seed まで。
- `packages/db` の `package.json` に Day 2 で `drizzle-orm` `drizzle-kit` `postgres`（or `pg`）を足す。
- `DATABASE_URL` を `.env`（新規）に置く。`.env.example` も作る（旧 TrendScope 版は削除済み）。
