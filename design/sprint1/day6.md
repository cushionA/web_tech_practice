# Sprint 1 Day 6 作業指示書

> テーマ: API と繋ぐ —— fetch ラッパ / TanStack Query / AuthProvider / React Hook Form で実ログイン
> 完了時の状態: `/login` で seed の admin として**実際にログインでき**、Cookie が保存され、`GET /api/auth/me` がユーザーを返す。誤パスワードはフォーム上部にエラー表示。web の単体テストが 1 本緑。
> 推定所要: 3〜4 時間
> 主に踏む層: `[FE]` `[TEST]`

参照: [design/07_frontend.md](../07_frontend.md)（データ取得・状態の分類）/ [design/06_auth.md](../06_auth.md)（フロント側の認証状態）/ [notes/react_basics.md](../../notes/react_basics.md)（4・6）

---

## Day6-1. 前提確認 [自分] [FE]

**前提確認**
- [ ] Day 5 完了：:5173 で静的なログイン画面が出る
- [ ] postgres（compose）+ api（:8787）が起動、seed 済み（`admin@example.com` / `password`）
- [ ] curl でログインすると `200` + `Set-Cookie` が返る（Day4-4 の完了確認と同じコマンド）
- [ ] [notes/react_basics.md](../../notes/react_basics.md) の「6. context」をやった

**完了確認**
- [ ] 2 つのターミナルで postgres + api が動いている
- [ ] `curl -s localhost:5173/api/health`（Vite proxy 経由）が OK

---

## Day6-2. lib/api/client.ts —— fetch ラッパと ApiError [自分] [FE] [設計]

**目的**
HTTP の詳細（baseURL / credentials / JSON / エラー整形）を 1 箇所に閉じ込める。**ここが「素の HTTP を理解する」の実践部分**（[02_tech_stack.md](../02_tech_stack.md) で tRPC を避けた理由）。

**自分で書く理由**
API クライアントの形は設計。エラーをどう型で握るか（`code` / `status`）を自分で決める。

**前提確認**
- [ ] [design/05_api.md](../05_api.md) の「エラー設計」（`{ error: { code, message, details } }`）を読んだ
- [ ] api が返すエラー JSON を curl で実際に見た（誤パスワードで `401`）

**手順**
1. `apps/web/src/lib/api/client.ts`。**ヒント**:
   - `class ApiError extends Error { constructor(public code: string, public status: number, message: string) { super(message) } }`
   - `const BASE = "/api"`（proxy 経由なので相対で OK）
   - `async function apiFetch<T>(path: string, init?: RequestInit): Promise<T>`:
     - `fetch(BASE + path, { credentials: "include", headers: { "content-type": "application/json", ...init?.headers }, ...init })`
     - `if (!res.ok)` → body を読んで `throw new ApiError(json.error.code, res.status, json.error.message)`
     - `204`（body 無し）をどう扱うか自分で決める
     - `return res.json() as T`
   - **`credentials: "include"` を忘れない**（Cookie が飛ばない）
2. `apps/web/src/lib/api/auth.ts`。**ヒント**:
   - `login(body: LoginRequest): Promise<{ user: UserDto }>` → `apiFetch("/auth/login", { method: "POST", body: JSON.stringify(body) })`
   - `me(): Promise<{ user: UserDto }>` → `apiFetch("/auth/me")`
   - `logout(): Promise<{ ok: true }>` → `apiFetch("/auth/logout", { method: "POST" })`
   - **型は `@app/shared` から import**（api と同じ zod スキーマ由来。これが monorepo の旨み）

**完了確認**
- [ ] devtools のコンソールから `login()` 相当を呼んで成功する（一時的に window に生やして試してよい。後で消す）
- [ ] Application タブで Cookie `sid` が保存されている
- [ ] 誤パスワードで `ApiError` が throw され、`code === "UNAUTHORIZED"` / `status === 401`
- [ ] `pnpm --filter @app/web typecheck` 緑

**詰まったら**
- Cookie が保存されない → `credentials: "include"`、proxy 経由（`/api` 相対）になっているか
- `@app/shared` の型が引けない → web の deps に `"@app/shared": "workspace:*"`、`pnpm install`、**`pnpm build` で shared の `dist` があるか**（[03_architecture.md](../03_architecture.md)）

---

## Day6-3. プロバイダ（Query / Auth） [自分] [FE] [設計]

**目的**
サーバ状態は TanStack Query、認証ユーザーは `AuthProvider`（中身は Query から）という**状態の置き場所**を決める（[07_frontend.md](../07_frontend.md) の「状態の分類」）。

**自分で書く理由**
「状態をどこに置くか」はフロント設計の背骨。なぜ Query を使い、なぜ Redux/Zustand を入れないかを語れるように。

**前提確認**
- [ ] [design/07_frontend.md](../07_frontend.md) の「データ取得」「状態の分類」を読んだ
- [ ] [design/06_auth.md](../06_auth.md) の「フロント側の認証状態」を読んだ
- [ ] `useEffect + fetch` でデータ取得を**しない**方針を理解した（[notes/react_basics.md](../../notes/react_basics.md) 4）

**手順**
1. `pnpm --filter @app/web add @tanstack/react-query`
2. `apps/web/src/lib/query.ts`：`queryClient` を**ここで作って export** する。
   - Day 7 の `router.tsx` からも使うので、`providers.tsx` の中で `new` しない
   - `new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } })`
   - `retry: false` の理由を考える（`401` を 3 回リトライしても意味がない）
3. `apps/web/src/app/providers.tsx`：`QueryClientProvider` で包むだけ。
4. `apps/web/src/features/auth/AuthProvider.tsx`。**ヒント**:
   - `useQuery({ queryKey: ["me"], queryFn: me })` を持つ
   - **`me` の `401` は「エラー」ではなく「未ログイン」**。`queryFn` 内で `catch` して `status === 401` なら `{ user: null }` を返すのが素直
   - context の値: `{ user: UserDto | null; isLoading: boolean }`
   - **context の value を毎レンダリング新しいオブジェクトで作らない**（[notes/react_basics.md](../../notes/react_basics.md) 6 で見た挙動）
   - `useAuth()` フック（Provider の外なら `throw`）
5. `App.tsx` を `<Providers><AuthProvider>...</AuthProvider></Providers>` の形に。

**完了確認**
- [ ] Network タブで初回に `GET /api/auth/me` が **1 回だけ**飛ぶ
- [ ] 未ログイン時に `401` が返ってもコンソールに未処理エラーが出ない（`user: null` に吸収）
- [ ] ログイン済みでリロードすると `user` が復元される（Cookie が効いている）
- [ ] `pnpm --filter @app/web typecheck` 緑

**詰まったら**
- `me` の 401 が Query の `error` になって画面が壊れる → `queryFn` 内で `catch` して `{ user: null }` を返す
- `me` が何度も飛ぶ → `staleTime` が効いていない or `queryKey` がずれている。`["me"]` で統一
- Provider の外で `useAuth` を呼んでいる → `App.tsx` のネスト順を確認

---

## Day6-4. LoginForm を実 API に繋ぐ（RHF + zod） [自分] [FE]

**目的**
Day 5 の `useState` 版を **React Hook Form + zod resolver + `useMutation`** に置き換える。バリデーションを「スキーマ 1 箇所」に寄せる型を作る。

**自分で書く理由**
フォームは全画面で使う。**Day 5 で素で書いた版と比べて、RHF が何を肩代わりしたかを言葉にする**のがこのタスクの本体。

**前提確認**
- [ ] Day 5 の `useState` 版が動いている（比較対象として）
- [ ] `@app/shared` の `LoginRequest` スキーマ（Day3-5）
- [ ] [docs/conventions/react.md](../../docs/conventions/react.md) の「フォーム」節

**手順**
1. `pnpm --filter @app/web add react-hook-form @hookform/resolvers`
   - **Zod のメジャーと `@hookform/resolvers` の対応**は Day1-1 で確認済みのはず。ズレていたらここで露見する
2. `LoginForm.tsx` を書き換え。**ヒント**:
   - `useForm<LoginRequest>({ resolver: zodResolver(LoginRequest) })`
   - `useMutation({ mutationFn: login, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }) })`
   - `onSubmit = handleSubmit((values) => mutation.mutate(values))`
   - サーバエラー（`ApiError`、`401`）は `mutation.error` を見てフォーム上部に「メールまたはパスワードが違います」
   - 送信中は submit ボタン disable（`mutation.isPending`）
   - `Field` に `register("email")` を挿す
3. **成功後の遷移は Day 7**（ルータがまだ無い）。今は `useAuth()` の `user` が埋まることで成功を確認する。
4. Day 5 の `useState` 版のコードは削除する。

**完了確認**
- [ ] 空送信 → フィールド下に zod のエラー
- [ ] 誤パスワード → フォーム上部にエラー、**入力値は消えない**
- [ ] 正しい資格情報 → `useAuth()` の `user` が埋まる（画面のどこかに `user.name` を仮表示して確認）
- [ ] リロードしてもログイン状態が維持される
- [ ] 送信中はボタンが disable
- [ ] **Day 5 の `useState` 版と比べて、RHF が何を肩代わりしたか説明できる**（再レンダリング回数、バリデーションの一元化、エラー状態の管理）

**詰まったら**
- `zodResolver` の型が合わない → `@hookform/resolvers/zod` から import。**Zod のメジャーと resolver のメジャーが対応しているか**（Day1-1）
- ログイン後 `me` が古いまま → `onSuccess` で `invalidateQueries({ queryKey: ["me"] })`
- `register` が `Field` に届かない → `Field` が props を `<input>` に spread しているか。届かないなら `Field` の設計を直す（Day5-3 の宿題）

---

## Day6-5. web の単体テスト 1 本 [自分] [TEST] [FE]

**目的**
CI の `test-web` ジョブを緑にする最低ライン。**ネットワークは MSW でモック**（[07_frontend.md](../07_frontend.md)）。

**前提確認**
- [ ] [design/07_frontend.md](../07_frontend.md) の「テスト」節を読んだ

**手順**
1. `pnpm --filter @app/web add -D vitest @testing-library/react @testing-library/user-event jsdom msw`
2. `apps/web/vitest.config.ts`（or `vite.config.ts` に `test` を追加）：`environment: "jsdom"`、`setupFiles`。
3. `apps/web/src/features/auth/LoginForm.test.tsx`。**検証**:
   - 空送信でバリデーションエラーが出る
   - MSW で `POST /api/auth/login` に `401` を返させ、フォーム上部にエラーが出る
   - MSW で `200` を返させ、`onSuccess` が走る
4. `apps/web/package.json` に `"test": "vitest run"`。
5. `.github/workflows/ci.yml` に `test-web` ジョブを足す（Day1-5 で `lint`/`typecheck` だけにしていたもの）。

**完了確認**
- [ ] `pnpm --filter @app/web test` が緑
- [ ] わざとエラー文言を変えるとテストが赤 → 戻す
- [ ] CI の `test-web` が緑

**詰まったら**
- `document is not defined` → `environment: "jsdom"`
- Query を使うコンポーネントのテストが落ちる → テスト内でも `QueryClientProvider` で包む。テスト用 `QueryClient` は `retry: false`

**AI 依頼テンプレ**（横展開）
```
apps/web/src/features/auth/LoginForm.test.tsx と同じ構成で、<対象> のテストを足したい。
MSW のハンドラも既存に合わせて。既存 spec を貼る。
```

---

## Day 6 終了チェックリスト

- [ ] `lib/api/client.ts`（`credentials: "include"` / `ApiError`）と `lib/api/auth.ts`
- [ ] `queryClient` は `lib/query.ts` に単独で存在（Day 7 の router から使う）
- [ ] `AuthProvider` + `useAuth`、`me` の `401` を「未ログイン」に吸収
- [ ] `LoginForm` が RHF + zod + `useMutation` で**実際にログインできる**
- [ ] web の単体テスト 1 本が緑、CI の `test-web` が緑
- [ ] `pnpm lint` / `typecheck` / `format:check` 緑
- [ ] 各タスク 1 PR

## Day 7 への引き継ぎメモ

- Day 7 でルータを入れると、ログイン成功後に `/dashboard` へ遷移するようになる。今の「仮表示で確認」は消す。
- `requireAuth` loader は `queryClient.ensureQueryData` で **`["me"]` の同じキャッシュ**を見る。だから `queryClient` を `lib/query.ts` に置いた。
- `DashboardShell` / `screens/registry.ts` / `/catalog` は Day 7。
