# 06. 認証・認可

方針: **マネージドを使わず、自前で薄く組んで土台を理解する**（[02_tech_stack.md](02_tech_stack.md)）。段階を追って作り、各段でトレードオフを言語化する。

## 学習ステップ

### Step 0: 完全ダミー認証 —— **飛ばす**

固定ユーザー + 平文比較 + メモリ Map、という段。**Sprint 1 では採用しない。**

理由: Sprint 1 Day 2 で `users` テーブルと seed（ハッシュ済み）が既に出来ているため、Step 0 を挟むと「後で捨てるコード」を書くことになる。**Sprint 1 Day 4 は Step 1 + Step 2 から始める**（[sprint1/day4.md](sprint1/day4.md)）。

この段の存在意義は「フロントを作る前に API の形だけ通す」ことだったが、その役割は Day 3 の `/health` + Day 4 の実装済み `/auth/*` が果たす。

### Step 1: DB ユーザー + パスワードハッシュ

- `users` テーブル（[04_database.md](04_database.md)）。
- ハッシュ: **Argon2id**（`@node-rs/argon2`）。パラメータ（memory / iterations / parallelism）の意味を調べてコメントに残す。
- **置き場所は `packages/db/src/lib/hash.ts`（決定事項）**。seed（`packages/db`）と api の両方が使うため。
  - `packages/shared` には置けない（web のバンドルに載る。argon2 は Node 専用）。
  - `apps/api` に置くと `packages/db` が app を import する逆流になる。
  - `@app/db` は既に api の依存なので、**db に置いて api が import する**のが唯一素直な向き。**同じ実装を 2 箇所に書かない**（seed と検証でライブラリがズレると詰む）。
- 登録 API は作らず、シードで admin/member を投入（公開登録は今回のスコープ外）。
- `login`: `findUserByEmail` → `verify(hash, password)` → OK でセッション発行。
- **平文パスワードをログ・エラー・レスポンスに出さない**。

### Step 2: DB セッション + Cookie 属性

- `sessions` テーブルにセッションを持つ。
- **Cookie は署名する（決定事項）**。`sid` は DB の uuid だが、**素で入れずに `SESSION_SECRET` で署名する**（`hono/cookie` の `setSignedCookie` / `getSignedCookie`）。
  - 目的は秘匿ではなく**改ざん検知**。署名が合わない Cookie は DB を引く前に弾ける（無駄なクエリを減らし、総当たりを検知できる）。
  - これがないと `SESSION_SECRET` という環境変数が存在するのに**どこにも使われない**状態になる（[03_architecture.md](03_architecture.md) の設定キー）。
  - 「uuid は 122 bit あるから署名は不要では？」という問いに自分で答えを出すこと。**答えは「エントロピー（推測されにくさ）と改ざん検知は別の性質」**。
- Cookie 属性を正しく:
  - `HttpOnly`（JS から読めない = XSS でのトークン窃取を防ぐ）
  - `SameSite=Lax`（CSRF 緩和。クロスサイトの GET 遷移では送るが POST では送らない）
  - `Secure`（`NODE_ENV=production` のとき。https 必須）
  - `Path=/`、`Max-Age`（= セッション有効期間）
- 失効: `expires_at` を過ぎたら `401`。`logout` で行削除 + Cookie を `Max-Age=0`。
- 期限切れセッションの掃除（cron 的なバッチ or ログイン時のついで削除）。
- **CSRF**: 変更系は POST/PATCH/DELETE のみ + `SameSite=Lax` で基本は足りる。学習として double-submit cookie token も 1 回実装して比較。

### Step 3: JWT（セッションとの比較）

- アクセストークン（短命 15分、`Authorization: Bearer`）+ リフレッシュトークン（長命、HttpOnly Cookie or DB）。
- 署名: HS256（`JWT_SECRET`）でまず理解 → RS256（公開鍵検証）に発展。
- `refresh_tokens` テーブル（回転 = 使ったら無効化、盗用検知）。
- **比較の観点**（ドキュメントに書く）:
  - ステートレス（JWT）vs ステートフル（セッション）
  - 失効の即時性（セッションは即、JWT は短命 + ブラックリスト）
  - 水平スケール時の扱い
  - トークンサイズ・毎リクエストの検証コスト
  - XSS / CSRF の攻撃面の違い

### Step 4: 認可（ロール）

- `role`（`admin` / `member`）。
- API: `middleware/auth.ts` で認証 → `requireRole('admin')` で認可。`403` を返す。
- フロント: `useAuth()` で `user.role` を持ち、ナビや操作ボタンを出し分け。**フロントの出し分けはセキュリティではない**（API 側が本丸）ことを明記。
- 認可マトリクスをテスト（member → admin API = 403）。

## 秘密の扱い

- `SESSION_SECRET` / `JWT_SECRET` は `.env`（gitleaks + pre-commit で混入防止）。
- `lib/config.ts` で起動時に存在チェック（無ければ即 exit）。
- ログ・エラーレスポンスにトークン / ハッシュ / secret を出さない（原則7）。

## フロント側の認証状態

- `features/auth/`：`AuthProvider`（context）+ `useAuth()`。
- 初回マウントで `GET /api/auth/me` を叩き、`user | null` を確定（それまで `loading`）。
- ルータ: `requireAuth` loader（React Router）で未認証を `/login` にリダイレクト。`from` を保持してログイン後に戻す。
- ログアウト: `POST /api/auth/logout` → Query キャッシュを破棄 → `/login`。

## 学習トピック

- ハッシュ関数（bcrypt / scrypt / Argon2）とソルト・ペッパー
- Cookie 属性一つ一つが防ぐ攻撃
- CSRF / XSS の具体的な攻撃シナリオと対策
- セッション vs トークンの設計判断
- リフレッシュトークン回転と盗用検知
- 認証（誰か）と認可（何をしてよいか）の分離
