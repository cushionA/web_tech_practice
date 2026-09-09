# Sprint 1 Day 7 作業指示書

> テーマ: 器を組む —— React Router data router / `requireAuth` loader / DashboardShell / 画面レジストリ / `/catalog`
> 完了時の状態: 未ログインで `/dashboard` に行くと `/login` にリダイレクト。ログインすると `/dashboard` にシェル（サイドバー + ヘッダ + Outlet）。`/catalog` に登録画面の一覧。**`screens/registry.ts` に 1 エントリ足すとナビ・ルート・カタログに自動反映**。
> 推定所要: 3〜4 時間
> 主に踏む層: `[FE]` `[設計]`

参照: [design/07_frontend.md](../07_frontend.md)（画面レジストリ・ルーティング）/ [design/09_screen_catalog.md](../09_screen_catalog.md)（追加の手順）/ [design/06_auth.md](../06_auth.md)（フロント側の認証状態）

> **Sprint 1 の最終日。** ここまで通れば「土台の縦切りが 1 本」通った状態になる。

---

## Day7-1. 前提確認 [自分] [FE]

**前提確認**
- [ ] Day 6 完了：`/login` から実際にログインでき、`useAuth()` の `user` が埋まる
- [ ] `queryClient` が `lib/query.ts` にある（`providers.tsx` の中で `new` していない）
- [ ] postgres + api が起動、seed 済み
- [ ] member ユーザーでもログインできる（認可の出し分け確認に使う）

**完了確認**
- [ ] `pnpm --filter @app/web test` が緑（Day 6 のテスト）

---

## Day7-2. ルータと requireAuth loader [自分] [FE] [設計]

**目的**
`/login` `/dashboard` `/catalog` のルートと、未認証を弾く `requireAuth` loader。**ルーティングの loader パターン**に触れる。

**自分で書く理由**
「未認証をどこで弾くか」（loader か、コンポーネントの中か）は設計判断。無限リダイレクトの罠も自分で踏んで理解する。

**前提確認**
- [ ] [design/07_frontend.md](../07_frontend.md) の「ルーティング」を読んだ
- [ ] **data router モード**を使う（framework モードではない。[02_tech_stack.md](../02_tech_stack.md)）

**手順**
1. `pnpm --filter @app/web add react-router-dom`
2. `apps/web/src/app/router.tsx`。**ヒント**:
   - `createBrowserRouter([...])`
   - `requireAuth` loader:
     - `queryClient.ensureQueryData({ queryKey: ["me"], queryFn: me })` を try
     - 結果の `user` が `null`（or catch で 401）なら `redirect("/login?from=" + encodeURIComponent(url.pathname))`
     - それ以外は `null` を返す（画面を通す）
     - **`ensureQueryData` を使う**ことで AuthProvider と同じキャッシュを共有 → 二重取得しない
   - ルート構成:
     ```
     /            → redirect("/dashboard")
     /login       → <LoginPage />（loader: 既ログインなら /dashboard に redirect）
     /（layout: <DashboardShell />, loader: requireAuth）
        /dashboard → <DashboardHome />
        /catalog   → <CatalogPage />
        （Day7-4 で screens/registry.ts のエントリをここに map）
     *            → <NotFound />
     ```
3. `App.tsx` で `<RouterProvider router={router} />`。
4. Day 6 の「`user.name` を仮表示」を消す。
5. `LoginForm` の `onSuccess` に `navigate(from ?? "/dashboard")` を足す（`from` は `useSearchParams().get("from")`）。

**完了確認**
- [ ] 未ログインで `/dashboard` → `/login?from=%2Fdashboard` にリダイレクト（**1 回だけ。ループしない**）
- [ ] ログイン後に元のページ（`from`）へ戻る
- [ ] ログイン済みで `/login` → `/dashboard` にリダイレクト
- [ ] `/nope` → NotFound
- [ ] Network タブで `me` が二重に飛んでいない
- [ ] `pnpm --filter @app/web typecheck` 緑

**詰まったら**
- **無限リダイレクト** → `/login` の loader と `requireAuth` が互いに飛ばし合っている。`/login` 側は「`user` が居れば dashboard、居なければ**通す**」、`requireAuth` は「居なければ login、居れば**通す**」。両方 `ensureQueryData` で同じキャッシュを見る
- loader で `me` が毎回飛ぶ → `staleTime` が効いていない or `queryKey` がずれている。`["me"]` で統一
- loader の中で hooks を呼んでいる → loader はコンポーネントではない。`queryClient` を import して使う

---

## Day7-3. DashboardShell [自分] [FE]

**目的**
「器」の外枠。サイドバー + ヘッダ + `<Outlet />`。ログアウトもここに置く。

**自分で書く理由**
レイアウトの構造（どこが固定で、どこが差し替わるか）は器の設計そのもの。

**前提確認**
- [ ] [design/07_frontend.md](../07_frontend.md) の「全体像」を読んだ
- [ ] `<Outlet />` が何をするか調べた

**手順**
1. `apps/web/src/features/dashboard/DashboardShell.tsx`。**ヒント**:
   - `const { user } = useAuth()`
   - ヘッダ: アプリ名 + `user.name` + ログアウトボタン
   - ログアウト: `useMutation(logout)` → `queryClient.clear()` → `navigate("/login")`
   - サイドバー: 今は静的リンクでよい（Day7-4 で registry から生成する）
   - `<main><Outlet /></main>`
   - レイアウトは Tailwind の flex / grid で最小限。**デザインに凝らない**
2. `apps/web/src/screens/Dashboard.tsx`：`default export`。今は「ようこそ、{user.name}」程度。

**完了確認**
- [ ] ログイン後 `/dashboard` にシェル（サイドバー + ヘッダ + 中身）が出る
- [ ] ログアウトで `/login` に戻り、`/me` が `401` になる（Cookie が消えている）
- [ ] ログアウト後にブラウザの戻るボタンで `/dashboard` に戻れない（loader が弾く）
- [ ] `queryClient.clear()` を消すと、ログアウト後も前ユーザーの情報が残ることを確認 → 戻す

**詰まったら**
- ログアウト後も `user` が残る → `queryClient.clear()`（または `["me"]` の `removeQueries`）を呼んでいるか
- `Outlet` に何も出ない → 子ルートが layout ルートの `children` になっているか

---

## Day7-4. 画面レジストリと /catalog [自分] [FE] [設計]

**目的**
**画面を 1 エントリ足すだけでナビ・ルート・カタログに載る**仕組み（[07_frontend.md](../07_frontend.md) の「画面レジストリ」）。**この仕組みが「後から画面を足す」体験を決める** —— Sprint 2 以降のすべてがここに乗る。

**自分で書く理由**
データ構造（`ScreenMeta`）と、それを router / nav / catalog がどう消費するかを自分で設計する。**この学習台で一番設計らしい設計**。

**前提確認**
- [ ] [design/07_frontend.md](../07_frontend.md) の「画面レジストリ」節を読んだ
- [ ] [design/09_screen_catalog.md](../09_screen_catalog.md) の「追加の手順」を読んだ

**手順**
1. `apps/web/src/screens/registry.ts`。**ヒント**（型は [07_frontend.md](../07_frontend.md) のサンプル）:
   - `interface ScreenMeta { id; title; path; requiredRole?: "admin"; patternTags: string[]; element: () => Promise<{ default: ComponentType }> }`
   - `export const screens: ScreenMeta[] = [ { id: "dashboard", title: "ダッシュボード", path: "/dashboard", patternTags: ["shell"], element: () => import("./Dashboard") } ]`
   - `patternTags` は「どの画面でどのパターンを練習したか」の索引。**あとで自分が見返すためのもの**
2. `router.tsx` を更新：`screens` を map してレイアウト配下に `<Route>` を生成（`lazy` で `element` を遅延ロード）。
3. `DashboardShell` のサイドバーを `screens` から生成：
   - `.filter(s => !s.requiredRole || s.requiredRole === user?.role)` して `<NavLink to={s.path}>{s.title}</NavLink>`
   - **フロントの出し分けはセキュリティではない**（[06_auth.md](../06_auth.md) Step 4）。API 側が本丸であることをコメントに残す
4. `apps/web/src/app/routes/CatalogPage.tsx`。**ヒント**:
   - `screens` を map してカード表示：`title` / `path`（リンク）/ `patternTags` をバッジ / `requiredRole` があれば印
   - 「ここに並ぶ = 練習した画面の索引」というコメント

**完了確認**
- [ ] `/catalog` に「ダッシュボード」のカードが 1 枚、`patternTags: shell` のバッジ付き
- [ ] **`registry.ts` にダミーエントリを 1 つ足すと、サイドバー・`/catalog`・ルートに自動で増える**（確認後は消す）
- [ ] `requiredRole: "admin"` のダミーを足すと、**member でログインしたときサイドバーに出ない**（admin では出る）
- [ ] Network タブで、`/catalog` を開くまで他画面の JS が読み込まれない（`lazy` が効いている）
- [ ] `pnpm --filter @app/web typecheck` 緑

**詰まったら**
- `lazy` import が型エラー → `element: () => import("./X")` の `X.tsx` が `default export` を持つか。React Router のバージョンによって `lazy` が `{ Component }` を返す形式もあるので、使っているバージョンのドキュメントに合わせる
- サイドバーの active スタイル → `NavLink` の `className={({isActive}) => ...}`
- registry に足したのにルートが増えない → `router.tsx` の map が layout ルートの `children` に入っているか

---

## Day 7 終了チェックリスト

- [ ] `requireAuth` loader が未認証を `/login?from=...` に弾く（**ループしない**）
- [ ] `DashboardShell`（サイドバー + ヘッダ + Outlet + ログアウト）
- [ ] `screens/registry.ts` に 1 エントリ足すとナビ・ルート・`/catalog` に自動反映
- [ ] `requiredRole` でサイドバーが出し分けられる
- [ ] `pnpm lint` / `typecheck` / `test` / `format:check` 緑、CI 緑
- [ ] 各タスク 1 PR

---

## Sprint 1 完了

ここまでで **土台の縦切りが 1 本通った**：

```
docker compose up → migration → seed → api 起動 → ログイン → ダッシュボードのシェル
```

次は [design/09_screen_catalog.md](../09_screen_catalog.md) から 1 つ選び、「DB → API → 画面 → registry に 1 行」のサイクルを回す（Sprint 2）。
候補は [sprint1_plan.md](../sprint1_plan.md) の「Sprint 1 完了後に残るタスク」。**#16 リクエストログ（[11_bot_detection.md](../11_bot_detection.md) の段 0）を最初に置くと、以降の一覧・ページング練習に本物のデータ量が供給される**ので効率がよい。

**E2E（Playwright）は Sprint 2 の頭で入れる。** 器が固まる前に書くと書き直しになるため、あえて Sprint 1 から外してある。
