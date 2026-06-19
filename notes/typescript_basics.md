# TypeScript 学習ノート

このノートは、TrendScope のスパイク実装で触れた TypeScript / Node.js の基本事項をまとめたもの。

## 1. TypeScript と JavaScript

TypeScript は JavaScript に型チェックを加えた言語。

- 開発中は、値の型やオブジェクトの形を検査できる
- 実行前に JavaScript へ変換される
- `type` や `interface` などの型情報は実行時には消える
- 外部 API の JSON を型指定しただけでは、実データの検証や変換は行われない

## 2. `interface` は値の形を定義する

`interface` は、オブジェクトが持つプロパティ名と型を定義する。

```ts
interface Article {
  id: string;
  title: string;
  url: string | null;
  tags: string[];
}
```

次のように変数や関数の戻り値の型として使う。

```ts
const article: Article = {
  id: "123",
  title: "TypeScript入門",
  url: null,
  tags: ["TypeScript"],
};
```

`interface` 自体から値を作るわけではないため、通常は `new` を使わない。

`new` は、主にクラスや `Date` などからインスタンスを作るときに使う。

## 3. `type` とユニオン型

複数の候補に限定したい場合は、`|`を使ったユニオン型を定義できる。
列挙体に近いが、C#のenumとの主な違いは、TypeScriptのtypeは型チェック専用で、JavaScript実行時には存在しない点。

```ts
type Source = "hackernews" | "qiita";
type Locale = "global" | "jp";
```

`Source` 型には、定義した文字列以外を代入できない。

単なる `string` よりも入力可能な値を限定でき、タイプミスも検出しやすい。

## 4. `null` を許可する型

値が存在しない可能性がある場合は、ユニオン型で `null` を含める。

```ts
url: string | null;
```

これは「文字列または `null`」という意味。

外部 API では、URLや所属情報などが欠けることがあるため、実データに合わせて型を定義する。

### null合体演算子 `??`

`??`は、左側が`null`または`undefined`の場合だけ、右側の値を使う演算子。

```ts
const normalizedUrl = item.url ?? null;
```

- `item.url`が文字列なら、その文字列を使う
- `item.url`が`null`または`undefined`なら、`null`を使う
- `0`、`false`、空文字列`""`は欠損扱いしない

外部APIで「プロパティがないため`undefined`」と「値がないことを表す`null`」が混在するとき、共通形式へ揃えるために使える。

### null合体代入演算子 `??=`

`??=`は、左側が`null`または`undefined`の場合に、右側の値を左側へ代入する。

```ts
item.url ??= null;
```

`??`との違いは、元のオブジェクトを変更すること。

- `??`：値を選ぶだけ。元データは変更しない
- `??=`：欠損時に元データへ代入する

入力を変更せず新しいオブジェクトを作るnormalizerでは、通常は`??`の方が意図に合う。

## 5. オブジェクトのプロパティを読む

次の2つは、基本的に同じプロパティを参照する。

```ts
item.title
item["title"]
```

- `item.title`：通常はこちらが読みやすい
- `item["title"]`：プロパティ名を変数で指定するときにも使える

```ts
const key = "title";
const value = item[key];
```

## 6. 配列と `map()`

`map()` は、配列の各要素を別の値へ変換し、新しい配列を作る。

```ts
const tags = [
  { name: "TypeScript" },
  { name: "React" },
];

const names = tags.map((tag) => tag.name);
```

結果は次の形になる。

```ts
["TypeScript", "React"]
```

元の配列を直接書き換えるのではなく、変換後の新しい配列を返す。

## 7. アロー関数

アロー関数は、短く関数を書く構文。

```ts
(tag) => tag.name
```

これは「`tag` を受け取り、`tag.name` を返す関数」という意味。

処理が複数行になる場合は波括弧を使う。

```ts
(value) => {
  const result = value * 2;
  return result;
}
```

波括弧を省略した場合は、右側の式が自動的に戻り値になる。

## 8. 外部データの正規化

APIごとに異なるデータ形式を、アプリ内の共通形式へ揃えることを正規化という。

例えば、人気度を表すフィールド名が取得元ごとに異なる場合でも、共通形式では同じ名前へ変換する。

```text
取得元Aの points ───┐
                    ├─→ 共通形式の popularity
取得元Bの likes ───┘
```

`interface` は共通形式を定義するだけで、実際の変換は関数内で行う。

## 9. 日時文字列とタイムゾーン

次の日時には `+09:00` というタイムゾーン情報が含まれている。

```text
2026-06-18T21:02:27+09:00
```

`+09:00` は「UTCより9時間進んでいる」という意味。

同じ瞬間をUTCで表すと、時刻は9時間前になる。UTCのISO文字列では末尾に`Z`が付く。

```text
2026-06-18T12:02:27.000Z
```

`Z`はUTC、つまり`+00:00`を表す。

日時を正規化するときは、日付部分だけを先に切り出さず、タイムゾーンを含む日時全体を解釈してからUTCへ変換する。

## 10. Unix秒とUnixミリ秒

Unix時刻は、1970年1月1日 00:00:00 UTCからの経過時間を数値で表す。

- Unix秒：秒単位。現在付近では約10桁
- Unixミリ秒：ミリ秒単位。現在付近では約13桁
- 1秒 = 1000ミリ秒

```text
Unix秒      1781288657
Unixミリ秒  1781288657000
```

APIがどちらの単位を返すかを確認し、日時を扱う機能が期待する単位へ合わせる必要がある。

単位を間違えると、1970年付近や極端な未来の日付になる。

## 11. `Date` とISO文字列

JavaScriptの`Date`は、日時を表す組み込みオブジェクト。

日時文字列にタイムゾーンが含まれていれば、その情報も含めて同じ瞬間として解釈する。

ISO形式へ変換すると、UTCに統一された文字列を得られる。

日時を共通形式に揃える利点：

- 日本時間と海外時間を同じ基準で比較できる
- 日別集計でタイムゾーン差によるズレを減らせる
- APIごとの日時形式を後続処理が意識しなくてよい

例：
日本時間は+9がついてるのでこれを使ってUTCに。
2026-06-18T21:02:27+09:00

## 12. `process`

`process` はNode.jsが提供する、現在実行中のプログラムに関する情報や機能を持つグローバルオブジェクト。

ブラウザJavaScriptではなく、Node.js環境で利用する。

主な用途：

- 環境変数を読む
- Node.jsのバージョンを確認する
- コマンドライン引数を読む
- 終了コードを設定する
- 現在の作業ディレクトリを確認する

## 13. `process.env`

`process.env`には環境変数が入る。

```ts
const token = process.env.API_TOKEN;
```

環境変数は未設定の場合があるため、取得結果は基本的に `string | undefined` と考える。

APIキーなどの秘密情報はコードへ直接書かず、環境変数から読む。

```ts
if (process.env.API_TOKEN) {
  // トークンが設定されている場合だけ使用する
}
```

## 14. `.env` と `process.loadEnvFile()`

`.env`は、環境変数をローカルファイルへ記述するためによく使われる形式。

```text
API_TOKEN=secret-value
```

Node.js 22では、`.env`の内容を`process.env`へ読み込む機能がある。

読み込んだ後は、通常の環境変数と同じように`process.env`から参照する。

`.env`には秘密情報が入るため、Gitへコミットしない。

## 15. `Promise` と非同期処理

`Promise`は、「今は完了していないが、将来完了または失敗する処理」を表す。

HTTP通信やファイル操作、待機処理などに使われる。

```ts
async function loadData() {
  const response = await fetch("https://example.com");
  return response.json();
}
```

- `async`：その関数が非同期処理を行うことを示す
- `await`：Promiseの完了を待ち、その結果を受け取る

C#の`Task`と`await`に近い考え方。

## 16. `setTimeout()`を使った待機

`setTimeout()`は、指定時間後に関数を実行する機能。

そのままでは`await`できないため、Promiseで包んだ待機関数を作ることがある。

ここで渡される完了関数を呼ぶとPromiseが完了し、待機していた処理が先へ進む。

APIへ短時間に大量アクセスしないための待機などに使う。

## 17. `any` の注意点

`any`は、TypeScriptの型チェックをほぼ無効にする型。

```ts
function normalize(value: any) {
  return value.title;
}
```

スパイクでは素早く試すために便利だが、存在しないプロパティを書いても型エラーにならない。

本実装では、外部APIの入力型を定義するか、実行時バリデーションを使う方が安全。

## 18. `interface` は外部JSONを検証しない

次の型指定だけでは、外部APIのレスポンスが本当にその形かは確認されない。

```ts
const item = response as Article;
```

これはTypeScriptへ「Articleとして扱う」と伝えているだけで、値の変換や検証ではない。

外部入力を実行時にも検証する場合は、次のような方法を使う。

- 自分で型を確認する
- 型ガードを作る
- Zodなどのバリデーションライブラリを使う

## 19. 今回の理解のつながり

```text
外部APIのJSON
  ↓
入力データの各プロパティを読む
  ↓
配列や日時を必要な形式へ変換する
  ↓
interfaceで定義した共通形式のオブジェクトを作る
  ↓
後続処理は取得元ごとの差を意識せず利用できる
```

重要なのは、`interface`が変換するのではなく、変換関数が値を組み立て、`interface`がその結果の形をチェックするという役割分担。
