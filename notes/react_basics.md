# React 学習ノート（素振り用）

Sprint 1 Day 5 に入る**前**に、このノートの内容を手を動かして確認する。目的は「Day 5〜7 で出てくる語彙を、初見にしないこと」。
アプリ（`apps/web`）とは別に、使い捨ての Vite プロジェクトを 1 つ作って壊しながら試すのがよい。

> このノートは**答えを書かない**。何を確認するか（チェック）と、詰まりやすい点だけを書く。コードは自分で書く。

---

## 0. 素振り環境

```
pnpm create vite react-sandbox --template react-ts
cd react-sandbox && pnpm install && pnpm dev
```

学習台のリポジトリには**コミットしない**（`labs/` にも置かない。使い捨て）。

---

## 1. コンポーネントと props

コンポーネントは「props を受け取って JSX を返す関数」。それ以上でも以下でもない。

- [ ] `function Hello({ name }: { name: string })` を書いて `<Hello name="a" />` で呼べた
- [ ] props を**変更しようとする**とどうなるか確かめた（read-only）
- [ ] `children` を受け取るコンポーネントを書いた
- [ ] 配列を `.map()` して要素を並べ、**`key` を付けないと警告が出る**ことを見た

**規約**（[docs/conventions/react.md](../docs/conventions/react.md)）: props は `interface` + 分割代入。`React.FC` は使わない。**`key` に配列の index を使わない**。

> **index を key にしてはいけない理由を体で理解する**: リストの先頭に要素を追加するボタンを作り、各行に `<input>` を置いて何か入力してから追加してみる。index が key だと**入力値が別の行にずれる**。これが「key は同一性の宣言であって順番ではない」ということ。

---

## 2. state（`useState`）

- [ ] カウンタを作った
- [ ] `setCount(count + 1)` を**同じイベント内で 2 回**呼んで、2 増えないことを確認した
- [ ] `setCount(c => c + 1)` なら 2 増えることを確認した（**更新関数形式**）
- [ ] オブジェクトの state を「直接書き換え」と「新しいオブジェクトを作る」の両方で試し、前者で再描画されないことを見た

**要点**: state の更新は**非同期にまとめられる**。「今の値」を元に計算するなら更新関数形式。

---

## 3. 再レンダリングを目で見る

ここが React で一番つまずく所。**まず観察する。最適化はしない。**

- [ ] 各コンポーネントの先頭に `console.log("render: Xxx")` を置いた
- [ ] 親の state を更新すると、**props が変わっていない子も再描画される**ことを確認した
- [ ] React DevTools の Profiler（または "Highlight updates"）で描画範囲を見た

**要点**: 再レンダリング＝関数がもう一度呼ばれるだけ。DOM 更新とは別。
**`memo` / `useMemo` / `useCallback` は今は使わない。** 効果を測れるようになってから（[07_frontend.md](../design/07_frontend.md)）。

---

## 4. `useEffect`

- [ ] 依存配列 `[]` / `[dep]` / 省略 の 3 通りで実行回数の違いを見た
- [ ] クリーンアップ関数（`return () => ...`）が**いつ**呼ばれるか確認した
- [ ] StrictMode の開発時に effect が **2 回**走ることを見た（本番では 1 回。バグではない）

**要点**: `useEffect` は「レンダリングの外側の世界と同期する」ためのもの。
**データ取得に `useEffect` を使わない**（Day 6 で TanStack Query を使う）。ここでは「なぜ避けるのか」を知るために一度だけ手で書いて、競合状態（古いレスポンスが後から届く）を体験しておくとよい。

---

## 5. フォームと制御コンポーネント

- [ ] `<input value={v} onChange={e => setV(e.target.value)} />`（制御）を書いた
- [ ] `value` だけ渡して `onChange` を渡さないと警告が出ることを見た
- [ ] `<form onSubmit>` で `e.preventDefault()` を忘れるとページが再読み込みされることを見た

Day 6 では React Hook Form を使うが、**その下で何が起きているか**を先に知っておく。

---

## 6. context

- [ ] `createContext` + Provider + `useContext` で値を配った
- [ ] Provider の外側で `useContext` を呼ぶと既定値になることを確認した
- [ ] **Provider の value を毎回新しいオブジェクトで作ると、下が全部再描画される**ことを見た

Day 6 の `AuthProvider` がこの形。

---

## 7. TypeScript との組み合わせ

- [ ] props の型を `interface` で書いた
- [ ] `useState<string | null>(null)` のようにジェネリクスで型を指定した
- [ ] イベントハンドラの型（`React.ChangeEvent<HTMLInputElement>` など）をエディタの補完から拾った

---

## 詰まったら

| 症状 | 見るところ |
|---|---|
| 画面が更新されない | state を直接書き換えていないか（新しい値を作る） |
| 無限ループする | `useEffect` の依存配列にオブジェクト/配列/関数を直接入れていないか |
| `Cannot read properties of undefined` | データ取得前の `undefined` を描画していないか（ローディング分岐） |
| key の警告 | `.map()` に安定した id を渡す |
| StrictMode で 2 回動く | 開発時の仕様。クリーンアップを正しく書けば問題にならない |

---

## この後

- **Day 5**: この素振りの内容だけで、静的なログイン画面を作る（API は繋がない）
- **Day 6**: API 通信 / TanStack Query / context / React Hook Form
- **Day 7**: ルーティング / レイアウトシェル / 画面レジストリ
