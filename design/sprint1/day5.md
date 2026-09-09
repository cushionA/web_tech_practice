# Sprint 1 Day 5 作業指示書

> テーマ: フロントの立ち上げ —— Vite + React + Tailwind v4 / 素の React で静的なログイン画面
> 完了時の状態: `pnpm --filter @app/web dev` で :5173 が立ち、Tailwind が効いた `/login` 相当の画面が出る。**API にはまだ繋がない。** 入力・バリデーション表示は `useState` だけで動く。
> 推定所要: 3〜4 時間（**React 未経験なら 1 日で終わらなくてよい**）
> 主に踏む層: `[FE]`

参照: [notes/react_basics.md](../../notes/react_basics.md)（**先にこれ**）/ [design/07_frontend.md](../07_frontend.md) / [docs/conventions/react.md](../../docs/conventions/react.md)

> **Day 5〜7 は元は 1 日だった。** React 未経験で「Vite + Tailwind + Query + context + Router + RHF + E2E」を 1 日に詰めるのは無理があるので 3 日に割った。
> Day 5 = 素の React で画面を作る / Day 6 = API と繋ぐ / Day 7 = ルーティングと器。**焦らず 1 日ずつ。**

---

## Day5-1. 前提確認 [自分] [FE]

**前提確認**
- [ ] **[notes/react_basics.md](../../notes/react_basics.md) の素振りを一通りやった**（特に「3. 再レンダリングを目で見る」と「5. フォームと制御コンポーネント」）
- [ ] api が `POST /api/auth/login` `/logout` `GET /api/auth/me` を返す（Day 4、curl で確認）— Day 5 では使わないが、Day 6 で要る
- [ ] `apps/web` に Day 1 で作った `package.json` / `tsconfig.json`（`composite: false` + `noEmit: true`）がある
- [ ] `pnpm build` で `packages/shared/dist` がある

**完了確認**
- [ ] `pnpm --filter @app/web typecheck` が緑（まだ空でも）

---

## Day5-2. Vite + React + Tailwind v4 を立ち上げる [自分] [FE]

**目的**
`apps/web` を React + Vite + Tailwind の最小構成にする。Day 1 の空パッケージに肉付けする形。

**自分で書く理由**
フロントのビルド構成（Vite / tsconfig の DOM・jsx・Bundler 上書き）を自分で通す。ここが分かると後で詰まらない。

**前提確認**
- [ ] [docs/conventions/react.md](../../docs/conventions/react.md) の「前提」（React / 新 JSX transform / tsconfig 上書き）を読んだ
- [ ] `apps/web/tsconfig.json` が Day 1 で DOM/jsx/Bundler を上書き済み（未なら今直す）

**手順**
1. 依存:
   ```
   pnpm --filter @app/web add react react-dom
   pnpm --filter @app/web add -D vite @vitejs/plugin-react typescript @types/react @types/react-dom
   pnpm --filter @app/web add -D tailwindcss @tailwindcss/vite
   ```
   — **Tailwind v4**。v3 と違い `tailwind.config.js` も `postcss.config.js` も autoprefixer も要らない（設定は CSS 側の `@theme` で行う）。
2. `apps/web/vite.config.ts`。**ヒント**:
   - `plugins: [react(), tailwindcss()]`（`@tailwindcss/vite` から import）
   - `server: { port: 5173, proxy: { "/api": "http://localhost:8787" } }`
     — **proxy で `/api` を api に流す**（フロントから見て同一オリジンになり Cookie 問題を避けられる）。
     **副作用として CORS が一度も発火しない**ことは意識しておく（[05_api.md](../05_api.md) の注意書き。CORS を踏む回は Sprint 2）
3. `apps/web/index.html`（ルート直下）:`<div id="root"></div>` + `<script type="module" src="/src/main.tsx">`
4. `apps/web/src/styles/index.css`:`@import "tailwindcss";` の 1 行だけ。
   - v4 は**コンテンツの自動検出**をするので `content` グロブの指定は不要。
   - 色や余白をカスタムしたくなったら同じファイルに `@theme { --color-brand: ...; }` を足す。ただし**当面はカスタムしない**（[07_frontend.md](../07_frontend.md) の「独自デザイントークンは作らない」）。
5. `apps/web/src/main.tsx`。**ヒント**:
   - `createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>)`
   - `import "./styles/index.css"`
6. `apps/web/src/App.tsx`：一旦 `<h1 className="text-2xl">hello</h1>` だけ。
7. `apps/web/package.json` の `scripts`:`"dev": "vite"`, `"build": "vite build"`, `"preview": "vite preview"`, `"typecheck": "tsc --noEmit"`

**完了確認**
- [ ] `pnpm --filter @app/web dev` で :5173 が開き、Tailwind が効いた "hello" が出る
- [ ] `text-2xl` を `text-6xl` に変えると即座に反映される（HMR）
- [ ] `curl -s localhost:5173/api/health`（proxy 経由）が api の `/health` を返す
- [ ] `pnpm --filter @app/web typecheck` 緑

**詰まったら**
- Tailwind が効かない → `vite.config.ts` の `plugins` に `tailwindcss()` が入っているか、`index.css` に `@import "tailwindcss";` があるか、`main.tsx` でその CSS を import しているか
- **ネットの記事が `tailwind.config.js` / `postcss.config.js` / `@tailwind base;` を作れと言ってくる** → それは v3 の記事。v4 では不要（むしろ混ぜると動かない）。日本語記事はまだ v3 が多いので、**公式ドキュメントの v4 を見る**
- `tsc` が `composite` で怒る → `apps/web/tsconfig.json` は `composite: false` + `noEmit: true`、ルート `references` には入れない（Day1-3）
- proxy が効かない → `vite.config.ts` の `server.proxy`、パスが `/api` で始まっているか

---

## Day5-3. Field コンポーネントと静的なログイン画面 [自分] [FE]

**目的**
**API には繋がない。** `useState` と props だけで、ログインフォームの見た目と挙動（入力・空欄チェック・送信中表示）を作る。React の基礎が体に入っているかの確認でもある。

**自分で書く理由**
「コンポーネントに分ける」「state をどこに置く」は最初に手で悩むべきところ。ライブラリを入れる前に素で一度やっておくと、Day 6 で React Hook Form が**何を肩代わりしているか**が分かる。

**前提確認**
- [ ] [notes/react_basics.md](../../notes/react_basics.md) の 1・2・5 を終えた
- [ ] [docs/conventions/react.md](../../docs/conventions/react.md) の props 規約（`interface` + 分割代入、`React.FC` 禁止）

**手順**
1. `apps/web/src/components/Field.tsx`。**ヒント**:
   - props: `{ label: string; error?: string; children: ReactNode }` あたり
   - `<label>` と `<input>` を `htmlFor` / `id` で結ぶ（**アクセシビリティ。eslint-plugin-jsx-a11y が見ている**）
   - エラーは `<p role="alert">` で出す
   - **input 自体は children で受ける**か props で受けるか、自分で決める（後で RHF の `register` を挿すことになるのを念頭に）
2. `apps/web/src/features/auth/LoginForm.tsx`。**この時点では API を呼ばない**。**ヒント**:
   - `useState` で `email` / `password` / `submitting` を持つ
   - `onSubmit` で `e.preventDefault()` → 空欄なら自前でエラー文字列を state に入れる → 埋まっていれば `console.log(values)` だけ
   - 送信中は submit ボタンを `disabled`
3. `apps/web/src/app/routes/LoginPage.tsx`：中央寄せのカードに `LoginForm` を置くだけ。Tailwind の `flex` / `min-h-screen` / `rounded` / `shadow` 程度。**デザインに凝らない**。
4. `App.tsx` から `LoginPage` を描画する（ルータはまだ無いので直接）。

**完了確認**
- [ ] 画面にラベル付きの email / password 入力と submit ボタンが出る
- [ ] 空で送信するとフィールド下にエラーが出る
- [ ] 埋めて送信すると devtools のコンソールに値が出る
- [ ] **Tab キーだけでラベル → 入力 → ボタンと移動できる**（`htmlFor`/`id` が効いている）
- [ ] `pnpm --filter @app/web typecheck` 緑 / `pnpm lint` 緑

**詰まったら**
- 入力しても文字が出ない → `value` を渡して `onChange` を渡していない（制御コンポーネント。[notes/react_basics.md](../../notes/react_basics.md) 5）
- 送信するとページが再読み込みされる → `e.preventDefault()`
- jsx-a11y の lint エラー → `<label htmlFor>` と `<input id>` が対応しているか

---

## Day5-4. 再レンダリングを観察する（小演習・成果物なし） [自分] [FE]

**目的**
Day 6 以降で「なぜ Query を使うのか」「なぜ context の value を毎回作り直してはいけないか」を理解する土台。**最適化はしない。観察だけ。**

**手順**
1. `LoginForm` と `Field` の先頭に `console.log("render: LoginForm")` などを置く。
2. email を 1 文字打つたびに、**何がどれだけ再描画されるか**を数える。
3. React DevTools の Profiler（または "Highlight updates"）で範囲を見る。
4. `console.log` を消す（コミットしない）。

**完了確認**
- [ ] 1 文字入力するたびに `LoginForm` と両方の `Field` が再描画されることを見た
- [ ] **それでも画面がカクついていない**ことを確認した（＝この規模では最適化は不要）
- [ ] `memo` / `useMemo` / `useCallback` を**入れていない**

> ここで得た感覚が Day 6 の「サーバ状態を Query に置く」「context の value を安定させる」に繋がる。

---

## Day 5 終了チェックリスト

- [ ] `pnpm --filter @app/web dev` で :5173、Tailwind v4 が効いている
- [ ] Vite proxy で `/api` → :8787
- [ ] `Field` + 静的 `LoginForm` + `LoginPage` が `useState` だけで動く
- [ ] `pnpm --filter @app/web typecheck` / `pnpm lint` / `pnpm format:check` 緑
- [ ] 再レンダリングを自分の目で観察した
- [ ] 各タスク 1 PR（**Day5-1 前提確認と Day5-4 小演習は成果物が無いので PR 対象外**）

## Day 6 への引き継ぎメモ

- Day 6 で `LoginForm` を **React Hook Form + zod resolver + useMutation** に置き換える。Day 5 の `useState` 版は**捨てる前提**で書いてよい（捨てるときに「RHF が何を肩代わりしたか」を言葉にする）。
- `Field` は Day 6 でも使い続ける。RHF の `register` を挿せる形になっているか、Day 6 の頭で見直す。
- api は `pnpm --filter @app/api dev`、postgres は compose で起動しておく。
