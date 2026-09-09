# 05. API 設計

正: `apps/api/src/`。フレームワークは Hono（[02_tech_stack.md](02_tech_stack.md)）。

## 原則

- **REST 風**。リソース指向の URL、HTTP メソッドで操作を表す。凝った HATEOAS はしない。
- **JSON in / JSON out**。エラーも JSON。
- **境界で検証**：body / query / params は `zod` で `parse`。越えたら型を信頼（[docs/conventions/README.md](../docs/conventions/README.md) 原則1）。
- **薄いルータ、太くないコントローラ**：ルータは「検証 → クエリ関数呼び出し → 整形して返す」だけ。ビジネスロジックが育ったら `services/` を作る（最初は要らない）。
- **SQL はルータに書かない**：`db/*.ts` のクエリ関数経由。

## URL 設計

| メソッド + パス | 用途 |
|---|---|
| `GET /health` | ヘルスチェック（DB 疎通含む） |
| `POST /api/auth/login` | ログイン |
| `POST /api/auth/logout` | ログアウト |
| `GET /api/auth/me` | 現在のユーザー |
| `GET /api/users` | ユーザー一覧（ページング・検索） |
| `GET /api/users/:id` | ユーザー詳細 |
| `POST /api/users` | 作成（admin のみ） |
| `PATCH /api/users/:id` | 更新 |
| `DELETE /api/users/:id` | 削除（admin のみ） |

- プレフィクス `/api`。将来のバージョニングは `/api/v1` にできる余地を残すが今はやらない。
- 一覧の query: `?page=1&perPage=20&q=foo&sort=created_at&order=desc`。すべて `zod` で既定値付きパース。

## リクエスト / レスポンスの型

`packages/shared/src/` に zod スキーマとして置き、api と web が import する。

```
// packages/shared/src/auth.ts（形のイメージ。実装はオーナー）
export const LoginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const UserDto = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(["admin", "member"]),
  createdAt: z.string().datetime(),
});
export type UserDto = z.infer<typeof UserDto>;
```

- **DB の行をそのまま返さない**。`password_hash` などを落とし、`UserDto` に整形してから返す。
- 日付は ISO 文字列で返す（`timestamptz` → `.toISOString()`）。

## 一覧レスポンスの形

```
{
  "data": [ UserDto, ... ],
  "pagination": { "page": 1, "perPage": 20, "total": 137, "totalPages": 7 }
}
```

- ページングは Sprint では OFFSET 方式（分かりやすい）。大きなデータの回でキーセット方式に差し替えて比較する。

## エラー設計

- HTTP ステータスを正しく使う：`400`（検証失敗）/ `401`（未認証）/ `403`（権限なし）/ `404`（無い）/ `409`（競合、例: email 重複）/ `422` は使わず `400` に寄せる / `500`（想定外）。
- ボディの形を統一：

```
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "email is invalid",
    "details": [ { "path": "email", "message": "Invalid email" } ]   // 任意
  }
}
```

- `code` はアプリ定義の文字列 enum（`VALIDATION_ERROR` / `UNAUTHORIZED` / `FORBIDDEN` / `NOT_FOUND` / `CONFLICT` / `INTERNAL`）。
- **例外は握り潰さない**（原則5）。`middleware/error.ts` で集約し、想定エラーは `code` 付きで、想定外は `500 INTERNAL` + サーバログ（スタックはログのみ、レスポンスに出さない）。
- 検証失敗は zod の `error.issues` を `details` に整形。

## ミドルウェア

| 名前 | 役割 |
|---|---|
| `logger` | メソッド・パス・ステータス・所要 ms を 1 行ログ。**body は出さない**（秘密が混じる） |
| `cors` | `WEB_ORIGIN` のみ許可、`credentials: true`（Cookie のため） |
| `error` | 上記のエラー整形。最外周に置く |
| `auth` | Cookie セッション（or JWT）を検証し `c.set("user", user)`。失敗で `401` |
| `requireRole('admin')` | `c.get("user").role` を見て `403` |

## 認証まわりの API 挙動

- `login` 成功: `Set-Cookie` でセッション（属性は [06_auth.md](06_auth.md)）。ボディに `UserDto`。
- `logout`: セッションを DB から削除 + `Set-Cookie` で失効（`Max-Age=0`）。
- `me`: 未ログインなら `401`（例外にしない、フロントが分岐する）。
- CSRF: Cookie セッション方式では `SameSite=Lax` + 変更系は `POST/PATCH/DELETE` に限定。学習の回で double-submit token も試す。

> **注意: Sprint 1 では CORS が発火しない。**
> [sprint1/day5.md](sprint1/day5.md) で Vite の `server.proxy` を使い `/api` を api に流すため、ブラウザから見ると**同一オリジン**になる。Cookie の問題を避けられる正しい選択だが、**上の `cors` ミドルウェアは一度も動かない**。
> 「Cookie と CORS / プリフライト」は学習トピックに挙げている以上、**proxy を外して直叩きし、CORS を実際に踏む回を Sprint 2 に置く**（[sprint1_plan.md](sprint1_plan.md) の残タスク）。踏むべきエラー: プリフライト（`OPTIONS`）の失敗、`Access-Control-Allow-Credentials` 無しで Cookie が送られない、`Allow-Origin: *` と `credentials` が併用できない。

## テスト

- ルータ単位：Hono の `app.request()` でリクエストを流し、ステータス・ボディ・`Set-Cookie` を検証。
- DB を触るものは Testcontainers。
- 認可マトリクス（member が admin 専用 API を叩いたら `403`）を回帰テストにする。

## 学習トピック

- HTTP メソッド / ステータス / 冪等性 / 安全性
- Cookie と CORS（`credentials`、プリフライト）
- バリデーションを「どこで一度だけ」やるか
- エラーを型と `code` でどう握るか
- ページング 2 方式のトレードオフ
- OpenAPI 生成（`@hono/zod-openapi`）とスキーマ駆動開発
