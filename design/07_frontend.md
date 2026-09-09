# 07. フロントエンド設計

正: `apps/web/src/`。規約は [docs/conventions/react.md](../docs/conventions/react.md)（React / 関数コンポーネント / hooks のみ / props は interface + destructure / `React.FC` 禁止 / index を key にしない 等）。本書はプロジェクト固有の構造。

## 全体像

「社内向け汎用管理コンソール」のシェル。**器を一度組み、画面は後から足す**。

```
app/                プロバイダとルータの組み立て
  providers.tsx     QueryClientProvider + AuthProvider
  router.tsx        React Router の data router 定義
screens/            「画面カタログ」— 追加していく単位
  registry.ts       画面のメタデータ配列（ここに 1 つ足すと一覧とルートに載る）
  <ScreenName>/     各画面（feature を組み合わせて 1 画面にする）
features/           機能単位の再利用ブロック
  auth/             AuthProvider, useAuth, LoginForm
  dashboard/        DashboardShell（サイドバー + ヘッダ + Outlet）
  users/            UserTable, UserForm, useUsers...
components/          横断 UI（Button, Modal, DataTable, Field, Spinner...）
lib/
  api/              fetch ラッパ + エンドポイント別関数 + TanStack Query hooks
  hooks/            汎用 hooks（useDebounce, useDisclosure...）
  utils/
styles/
  index.css         Tailwind エントリ
```

## 画面レジストリ（後から足す仕組み）

追加を「1 ファイル足すだけ」にするための仕掛け。

```
// screens/registry.ts（形のイメージ。実装はオーナー）
export interface ScreenMeta {
  id: string;                  // "users", "audit-log"
  title: string;               // ナビ表示名
  path: string;                // "/users"
  icon?: ComponentType;        // 任意
  requiredRole?: "admin";      // 認可
  patternTags: string[];       // ["CRUD", "pagination"] — 学習パターンの索引
  loadComponent: () => Promise<{ default: ComponentType }>;  // 遅延 import
}

export const screens: ScreenMeta[] = [
  { id: "dashboard", title: "ダッシュボード", path: "/dashboard",
    patternTags: ["shell"], loadComponent: () => import("./Dashboard") },
  // ここに 1 行足すと、ナビ・ルート・カタログページに自動で載る
];
```

- `router.tsx` は `screens` を map して `<Route>` を生成。**data router の `route.lazy` は `{ Component, loader, ... }` という route object の一部を返す契約**なので、`{ default: ... }` をそのまま渡さず変換する:
  `lazy: async () => ({ Component: (await s.loadComponent()).default })`
  （フィールド名を `element` にしないのは、React Router の `element`（= ReactNode）と紛らわしいため）
- `DashboardShell` のサイドバーは `screens` を map してリンク生成（`requiredRole` でフィルタ）。
- `/catalog` 画面：`screens` を一覧表示し、`patternTags` で「どの画面でどのパターンを練習したか」を俯瞰できる。

**新しい画面 / デザインパターンを作りたくなったら**：`screens/<Name>/` を作り、`registry.ts` に 1 エントリ足す。DB/API が要るなら [09_screen_catalog.md](09_screen_catalog.md) の手順で下の層から。

## データ取得

- **すべて TanStack Query 経由**。生 `useEffect + fetch` は書かない（[react.md] の副作用方針）。
- `lib/api/client.ts`：`fetch` の薄いラッパ。`credentials: "include"`、baseURL、JSON パース、エラー時に `ApiError`（`code`/`status`/`message`）を throw。
- `lib/api/users.ts`：`listUsers(params)` などのエンドポイント関数。返り値は `shared` の DTO 型。
- `features/users/useUsers.ts`：`useQuery({ queryKey: ["users", params], queryFn })`。変更系は `useMutation` + `invalidateQueries`。
- 楽観更新は「削除」の回で 1 度導入して仕組みを理解。

## ルーティング

- **React Router の data router**（`createBrowserRouter`）。
- `loader` で「その画面に必要なデータの事前取得 / 認証チェック」。`action` でフォーム送信。
- `requireAuth` loader：`GET /api/auth/me` 相当を Query の `ensureQueryData` で叩き、`null` なら `redirect("/login?from=...")`。
- エラーは `errorElement`（ルート単位）+ 最上位の `RouteErrorBoundary`。

## フォーム

- **React Hook Form + `@hookform/resolvers/zod`**。スキーマは可能なら `shared` のリクエスト型を再利用。
- フィールドは `components/Field`（label + input + error）で統一。
- 送信中は disable、失敗は `code` を見てフィールド or フォーム全体にエラー表示。

## 状態の分類（どこに置くか）

| 種類 | 置き場所 |
|---|---|
| サーバのデータ（users, me, ...） | TanStack Query キャッシュ |
| 認証ユーザー | `AuthProvider` context（中身は Query から） |
| フォーム入力中の値 | React Hook Form |
| UI のローカル状態（モーダル開閉、タブ選択） | `useState` / `useDisclosure` |
| URL に載せたい状態（一覧のページ・検索語・ソート） | `useSearchParams` |
| グローバルなクライアント状態 | 基本作らない。必要なら context。Redux/Zustand は今は入れない |

## スタイル

- Tailwind v4。`styles/index.css` に `@import "tailwindcss";` の 1 行。設定ファイル（`tailwind.config.js` / `postcss.config.js`）は無い。
- 色・余白は Tailwind 既定のスケールに乗る。独自デザイントークンは作らない。
- ダーク/ライトは「テーマ切替パターン」を練習する回で `class` 戦略で入れる（それまで light 固定）。
- アクセシビリティが要る部品（Modal / Menu / Combobox）は Radix UI プリミティブを使う。

## テスト

- 単体: Vitest + Testing Library。`components/` と `features/*/use*.ts`（hooks）中心。
- E2E: Playwright。`e2e/` に「ログイン → ダッシュボード表示」「member はユーザー作成ボタンが出ない」などの通しシナリオ。
- MSW でネットワークをモックするのは単体側。E2E は実 API（compose）に当てる。

## 学習トピック

- コンポーネント / props / state / effect / context の役割分担
- レンダリングの仕組みと再レンダリング（`memo` / `useMemo` / `useCallback` を「効果を測ってから」使う）
- サーバ状態とクライアント状態の分離（なぜ Query を使うか）
- ルーティングと loader/action パターン
- フォームの制御 / 非制御、バリデーションの一元化
- 一覧 UI の定番（検索・ソート・ページング・空/エラー/ローディング表示）
- コード分割（遅延 import）とバンドル
