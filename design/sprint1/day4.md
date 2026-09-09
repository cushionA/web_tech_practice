# Sprint 1 Day 4 作業指示書

> テーマ: 認証と認可 —— DB ユーザー + Argon2 + 署名付き Cookie セッション + ロールガード
> 完了時の状態: `POST /api/auth/login` で admin にログインでき `Set-Cookie: sid=...` が返る。`GET /api/auth/me` が Cookie からユーザーを返す。`POST /api/auth/logout` でセッション破棄。`requireRole("admin")` で member を弾く。認可マトリクスのテストが緑。
> 推定所要: 3〜3.5 時間
> 主に踏む層: `[BE]` `[TEST]`

参照: [design/06_auth.md](../06_auth.md)（学習ステップ Step 1〜4）/ [design/05_api.md](../05_api.md)（認証まわりの API 挙動）/ [docs/conventions/typescript.md](../../docs/conventions/typescript.md)

> Note: これは [06_auth.md](../06_auth.md) の **Step 1 + Step 2**（DB ユーザー + ハッシュ + 署名付き Cookie セッション）。**Step 0（完全ダミー）は設計上そもそも採用しない**（Day 2 で users と seed が既に在るため、捨てるコードになる）。JWT（Step 3）と CSRF トークン（Step 2 応用）は Sprint 2。

---

## Day4-1. 前提確認 [自分] [BE]

**前提確認**
- [ ] `GET /health` が `200`（Day 3）
- [ ] `pnpm --filter @app/db seed` 済みで adminer に admin/member が見える
- [ ] `packages/shared` に `LoginRequest` / `UserDto`
- [ ] `.env` に `SESSION_SECRET`（32 文字以上）

**完了確認**
- [ ] `curl -s http://localhost:8787/health` OK
- [ ] Day 4 用ブランチに切っている

---

## Day4-2. Argon2id を理解する（実装は Day 2 で済んでいる） [自分] [BE]

**目的**
ハッシュの実装は **Day2-5 で `packages/db/src/lib/hash.ts` に作った**。ここでは**新しく書かない**。パラメータ（メモリコスト・時間コスト・並列度）の意味を調べてコメントに残し、テストで性質を確認する。

**自分で書く理由**
「パスワードどう保存してる？」は面接頻出。Argon2id を選んだ理由、パラメータの意味を語れる必要がある。

**前提確認**
- [ ] [design/06_auth.md](../06_auth.md) の Step 1（ハッシュ）と「学習トピック」を読んだ
- [ ] `packages/db/src/lib/hash.ts` が存在し、barrel から export されている（Day2-5）
- [ ] **`apps/api` に hash を新規作成しない**ことを理解した（[06_auth.md](../06_auth.md) Step 1 の決定事項。seed と検証でライブラリがズレると必ず詰む）

**手順**
1. `packages/db/src/lib/hash.ts` に**コメントを追記**する:
   - なぜ Argon2id か（GPU 攻撃耐性 + サイドチャネル耐性のバランス。bcrypt / scrypt との違い）
   - デフォルトパラメータの目安（memory ~19MiB, iterations 2, parallelism 1）とそれぞれが何を上げるか
   - 本番では「1 回の検証にかかる時間」を測って調整すること
2. api からは `import { hashPassword, verifyPassword } from "@app/db"` で使う。**`apps/api/src/lib/hash.ts` は作らない**。
3. `packages/db/test/hash.test.ts`：`hashPassword` → `verifyPassword` が `true`、間違ったパスワードで `false`、同じ入力でもハッシュ文字列が毎回変わる（ソルト）。

**完了確認**
- [ ] `pnpm --filter @app/db test hash` が緑
- [ ] `hashPassword("a")` を 2 回呼ぶと違う文字列（ソルトが効いている）
- [ ] `grep -r "node-rs/argon2" apps/` が**ヒットしない**（api が直接 argon2 を触っていない）
- [ ] コメントを読んで Argon2id 採用理由とパラメータの意味を説明できる

**詰まったら**
- native ビルド失敗 → `bcryptjs` にフォールバック可（`hash`/`compare`）。**`packages/db` の 1 箇所だけ差し替えれば seed も api も同時に切り替わる** —— 実装を 1 箇所に置いた効果がここで出る。コメントで「本来 Argon2id、環境都合で bcrypt」と明記
- `Cannot find module '@app/db'` → `pnpm build` で db の `dist` を作ったか（[03_architecture.md](../03_architecture.md)）

---

## Day4-3. db/users.ts・db/sessions.ts —— クエリ関数 [自分] [BE]

**目的**
SQL を `db/` に閉じ込め、ルータからは「関数」を呼ぶ（[03_architecture.md](../03_architecture.md)）。Drizzle のクエリビルダに慣れる。

**自分で書く理由**
データアクセス層の切り方は設計。`findUserByEmail` が何の SQL になるか（生成 SQL を読む）を理解する。

**前提確認**
- [ ] `@app/db` の barrel から `db`（Drizzle）と `schema` が使える
- [ ] [design/04_database.md](../04_database.md) の `users` / `sessions` スキーマ

**手順**
1. `apps/api/src/db/index.ts`：**api 側で drizzle を作り直さない**。`@app/db` が公開している `db` をそのまま import して使う（Day2-3 で `sql` / `db` に分けた）。
2. `apps/api/src/db/users.ts`。**ヒント**（返り値型は明示）:
   - `findUserByEmail(email: string): Promise<UserRow | undefined>` → `db.select().from(users).where(eq(users.email, email)).limit(1)` の `[0]`
   - `findUserById(id: string): Promise<UserRow | undefined>`
   - `UserRow` は `typeof users.$inferSelect`
3. `apps/api/src/db/sessions.ts`。**ヒント**:
   - `createSession(userId: string, ttlMs: number, userAgent?: string): Promise<SessionRow>` → `expiresAt = new Date(Date.now() + ttlMs)` を insert、`returning()` で返す
   - `findValidSession(sid: string): Promise<{ session: SessionRow; user: UserRow } | undefined>` → `sessions` と `users` を join（or 2 クエリ）、`expiresAt > now()` を条件に
   - `deleteSession(sid: string): Promise<void>`
   - `deleteExpiredSessions(): Promise<number>`（掃除用、Day 8 で cron 化）
4. `apps/api/src/db/to-dto.ts`：`userRowToDto(row: UserRow): UserDto`（`password_hash` を落とし、`createdAt` を `.toISOString()`）。

**完了確認**
- [ ] `pnpm --filter @app/api typecheck` 緑
- [ ] （Testcontainers テストで）`findUserByEmail("admin@example.com")` が seed のユーザーを返す
- [ ] `findValidSession` が期限切れセッションを返さない（`expiresAt` を過去にした行を作って確認）

**詰まったら**
- join の書き方 → まず 2 クエリ（session 取得 → user 取得）で動かし、後で `leftJoin` に最適化。N+1 の学習ポイント
- `$inferSelect` が `unknown` → schema の barrel が型を export しているか

---

## Day4-4. routes/auth.ts —— login / logout / me [自分] [BE] [設計]

**目的**
認証エンドポイント 3 本。**境界で `LoginRequest.parse`**、成功で `Set-Cookie`、`me` は未認証で `401`（例外にしない）。

**自分で書く理由**
認証フローは面接で必ず突っ込まれる。Cookie に何を入れ、どう検証し、どう失効させるかを自分で実装して語れるように。

**前提確認**
- [ ] [design/05_api.md](../05_api.md) の「認証まわりの API 挙動」
- [ ] [design/06_auth.md](../06_auth.md) の Step 2（Cookie 属性）
- [ ] Hono の Cookie ヘルパ（`hono/cookie` の **`setSignedCookie` / `getSignedCookie`** / `deleteCookie`）を軽く調べた
- [ ] **Cookie は署名する**（[06_auth.md](../06_auth.md) Step 2 の決定事項）。目的は秘匿ではなく**改ざん検知**で、これによって `SESSION_SECRET` が初めて意味を持つ

**手順**
1. `apps/api/src/routes/auth.ts`。**ヒント**:
   - `const auth = new Hono()`
   - **POST `/login`**:
     - `const body = LoginRequest.parse(await c.req.json())`（ZodError は error ミドルウェアが 400 に）
     - `const user = await findUserByEmail(body.email)` → 無ければ `throw unauthorized("invalid credentials")`
       （**ユーザー有無で挙動を変えない**メッセージにする = ユーザー列挙を防ぐ）
     - `const ok = await verifyPassword(user.passwordHash, body.password)` → `false` なら同じく `unauthorized`
     - `const session = await createSession(user.id, SESSION_TTL_MS, c.req.header("user-agent"))`
     - `await setSignedCookie(c, "sid", session.id, config.SESSION_SECRET, { httpOnly: true, sameSite: "Lax", path: "/", maxAge: SESSION_TTL_MS/1000, secure: config.NODE_ENV === "production" })`
       — **署名付き**。`setCookie` ではない
     - `return c.json({ user: userRowToDto(user) })`
   - **POST `/logout`**:
     - `const sid = await getSignedCookie(c, config.SESSION_SECRET, "sid")` → あれば `deleteSession(sid)`
     - `deleteCookie(c, "sid", { path: "/" })`
     - `return c.json({ ok: true })`
   - **GET `/me`**:
     - `const user = c.get("user")`（auth ミドルウェアが set。Day4-5）→ 無ければ `throw unauthorized()`
     - `return c.json({ user: userRowToDto(user) })`
   - `SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7`（7 日）をモジュール定数で
2. `app.ts` で `app.route("/api/auth", auth)`。
3. `/me` には auth ミドルウェアを付ける（`auth.use("/me", authMiddleware)` or ルート単位）。`/login` `/logout` には付けない。

**完了確認**
- [ ] `curl -i -X POST localhost:8787/api/auth/login -H 'content-type: application/json' -d '{"email":"admin@example.com","password":"password"}'` が `200` + `Set-Cookie: sid=...; HttpOnly; ...`
- [ ] 誤パスワードで `401 { error: { code: "UNAUTHORIZED" } }`（メッセージがユーザー有無で変わらない）
- [ ] Cookie を付けて `curl -b "sid=..." localhost:8787/api/auth/me` が `200` + `UserDto`
- [ ] Cookie 無しで `/me` が `401`
- [ ] `logout` 後、同じ Cookie で `/me` が `401`（セッションが DB から消えている）
- [ ] **Cookie の値を 1 文字書き換えて `/me` を叩くと `401`**。このとき**サーバログに DB クエリが出ない**（署名検証で DB を引く前に弾いている）
- [ ] `.env` の `SESSION_SECRET` を変えると既存 Cookie が全部無効になる（署名鍵のローテーション = 全ログアウト、という性質を確認）

**詰まったら**
- `Set-Cookie` がブラウザに保存されない（Day 5 で判明） → `SameSite` / `Secure` / origin の組み合わせ。ローカル http なら `Secure` は付けない
- `c.req.json()` が落ちる → `content-type: application/json` ヘッダが要る
- `c.get("user")` が型エラー → Hono の `Variables` 型を宣言（`new Hono<{ Variables: { user?: UserRow } }>()`）
- `getSignedCookie` が常に `false` / `undefined` を返す → 署名時と検証時で **`SESSION_SECRET` が同じか**（api を再起動せず `.env` だけ変えた等）。Hono の signed cookie は検証失敗時に例外ではなく偽値を返すので、`if (!sid) return 401` を必ず書く

---

## Day4-5. middleware/auth.ts + requireRole [自分] [BE]

**目的**
「Cookie からセッションを引き、ユーザーを `c` に載せる」ミドルウェアと、「role が足りなければ 403」のガード。**フロントの出し分けはセキュリティではない、API 側が本丸**（[06_auth.md](../06_auth.md) Step 4）。

**自分で書く理由**
認可の実装場所（ミドルウェア）と粒度（ルート単位 / メソッド単位）は設計判断。

**前提確認**
- [ ] [design/06_auth.md](../06_auth.md) の Step 4（認可）
- [ ] [design/05_api.md](../05_api.md) の「ミドルウェア」表（`auth` / `requireRole`）
- [ ] Day4-4 で `setSignedCookie` / `getSignedCookie` を使ったことを確認した（**ここでも同じ読み方に揃える**）

**手順**
1. `apps/api/src/middleware/auth.ts`。**ヒント**:
   - `createMiddleware(async (c, next) => { const sid = await getSignedCookie(c, config.SESSION_SECRET, "sid"); if (sid) { const found = await findValidSession(sid); if (found) c.set("user", found.user) } await next() })`
   - **`getCookie` ではなく `getSignedCookie`**。Day4-4 の `setSignedCookie` と対にする。素の `getCookie` で読むと署名付きの文字列をそのまま session UUID として DB 検索することになり、`/me` が通らない
   - `getSignedCookie` は**検証失敗時に例外ではなく偽値**を返す。`if (sid)` で弾けば「改ざん Cookie は DB を引く前に落ちる」（Day4-4 の完了確認）が成立する
   - **ここでは 401 を投げない**（`/me` のような「未認証も正常系」があるため）。認証必須のルートは下の `requireAuth` で
   - `export const requireAuth = createMiddleware(async (c, next) => { if (!c.get("user")) throw unauthorized(); await next() })`
   - `export const requireRole = (role: "admin") => createMiddleware(async (c, next) => { const u = c.get("user"); if (!u) throw unauthorized(); if (u.role !== role) throw forbidden(); await next() })`
2. `app.ts` で `app.use("*", authMiddleware)`（全ルートでセッションを見る、軽いので OK）。
3. 認証必須ルートに `requireAuth`、admin 専用に `requireRole("admin")` を付ける。今は `/api/auth/me` に `requireAuth` だけ。Day 5 以降のユーザー管理 API で `requireRole` を使う。
4. 動作確認用に一時ルート `GET /api/_admin-ping`（`requireRole("admin")`）を置いてテスト後に消す。

**完了確認**
- [ ] admin の Cookie で `/api/_admin-ping` が `200`
- [ ] member の Cookie で `/api/_admin-ping` が `403 { error: { code: "FORBIDDEN" } }`
- [ ] Cookie 無しで `403` ではなく `401`
- [ ] 一時ルートを消した

**詰まったら**
- 全ルートで DB クエリが走るのが気になる → セッション検証は 1 クエリ。気になれば後でセッションキャッシュ（Sprint 2）。今は素直に
- `requireRole` の型 → カリー化した middleware を返す形。Hono の `createMiddleware` の戻りをそのまま返す

---

## Day4-6. 認証・認可テスト（マトリクス） [自分] [TEST]

**目的**
認証の正常系・異常系と、認可マトリクス（誰がどのルートを叩けるか）を回帰テストにする。

**自分で書く理由**
「どこまでテストすれば認証を信頼できるか」の線引きは設計。マトリクスの観点を自分で決める。

**前提確認**
- [ ] Day4-2〜4-5 が動く
- [ ] Testcontainers セットアップ（Day 2）を api テストでも使えるようにする（共通ヘルパに切り出すとよい）

**手順**
1. `apps/api/test/helpers/db.ts`：Testcontainers で postgres 起動 → migrate → seed（admin/member）を行う `setupTestDb()` を作る（Day 2 のコードを流用）。
2. `apps/api/test/auth.test.ts`。**検証**:
   - login: 正しい資格情報で `200` + `Set-Cookie`
   - login: 誤パスワードで `401`、存在しない email でも `401`（同じメッセージ）
   - login: body が不正（email 形式でない）で `400 VALIDATION_ERROR`
   - me: ログイン後の Cookie で `200` + 正しい `UserDto`（`password_hash` を含まない）
   - me: Cookie 無しで `401`
   - logout: 後に同じ Cookie で me が `401`
   - 認可マトリクス（`requireRole("admin")` の一時ルート or Day 5 の実ルートを前借り）:
     | 呼び手 | admin ルート | member でも可のルート |
     |---|---|---|
     | 未認証 | 401 | 401 |
     | member | 403 | 200 |
     | admin | 200 | 200 |
3. `Set-Cookie` から `sid` を抜いて次のリクエストに `Cookie` ヘッダで付ける小ヘルパを書く。
4. `pnpm --filter @app/api test` 緑。CI の `test-api` も緑。

**完了確認**
- [ ] `pnpm --filter @app/api test` 緑（認証 + マトリクス）
- [ ] `password_hash` がどのレスポンスにも出ていないことをテストで固定
- [ ] CI 緑

**AI 依頼テンプレ**（マトリクス拡張）
```
apps/api/test/auth.test.ts の認可マトリクスに、<新ルート> の行を足したい。
setupTestDb と Cookie 抜き出しヘルパは既存を流用。表の形は
| 呼び手(未認証/member/admin) | 期待ステータス | で。既存ファイルを貼る。
```

---

## Day 4 終了チェックリスト

- [ ] `lib/hash.ts`（Argon2id、コメントで理由）+ テスト緑
- [ ] `db/users.ts` `db/sessions.ts`（クエリ関数、返り値型明示）
- [ ] `POST /api/auth/login`（`Set-Cookie` / ユーザー列挙対策）、`/logout`（セッション破棄）、`GET /api/auth/me`（未認証 401）
- [ ] `middleware/auth.ts`（セッション → `c.set("user")`）、`requireAuth` / `requireRole`
- [ ] 認証 + 認可マトリクスのテストが緑、`password_hash` 非漏洩を固定
- [ ] Cookie 属性: `HttpOnly` / `SameSite=Lax` / `Path=/` / `Secure` は本番のみ
- [ ] 各タスク 1 PR、CI 緑

## Day 5 への引き継ぎメモ

- Day 5 は `apps/web` に React + Vite。`LoginForm` から `POST /api/auth/login`、`useAuth` が `GET /api/auth/me`。
- フロントは `credentials: "include"` で fetch（Cookie を送るため）。api の CORS は Day 3 で `credentials: true` 済み。
- ローカルは web :5173 / api :8787 でポートが違う → **クロスオリジン**。`SameSite=Lax` の Cookie は「トップレベル遷移でない fetch」でも同一サイト扱いになる条件に注意。うまく送られない場合は Vite の `server.proxy` で `/api` を :8787 に流して同一オリジンにする（Day 5 の指示書で扱う）。
