// Day1-4 [自分-B] 正規化スキーマ。design/06_destinations.md の CollectedItem を spike 用に写経し、
// 実データ（out/*-raw.jsonl）に当てて過不足を findings.md に記録するのが目的。

// データの取得元。ここに書かれた文字列以外は代入できない
export type Source = "hackernews" | "qiita" | "github_trending";

// データが主に属する地域・言語圏
export type Locale = "global" | "jp";

// 1 収集アイテム = 1 文書（言及の母体）。design/06 の CollectedItem 相当
export interface SpikeItem {
  source: Source;       // 取得元。例: "hackernews"、"qiita"
  externalId: string;   // 取得元が記事に付けた ID。dedup キーは `${source}:${externalId}`
  title: string;        // 記事や投稿のタイトル
  url: string | null;   // 記事の URL。HN の self-post（Ask HN 等）は URL がないため null
  tags: string[];       // 技術タグの一覧。Qiita は tags[].name、タグのない HN は []
  popularity: number;   // 取得元内での人気度。HN は points、Qiita は likes_count
  publishedAt: string;  // 公開日時。UTC の ISO 8601 形式へ正規化する
  locale: Locale;       // 主な地域・言語圏。HN は "global"、Qiita は "jp"
}

// TODO(Day1-4): HN Algolia の 1 hit → SpikeItem
// ヒント: created_at_i は Unix「秒」。new Date(sec * 1000).toISOString()
//         url が無い hit もある（null にする）。popularity は points
export function fromHnHit(hit: any): SpikeItem {
  return {
  source:"hackernews",       // 取得元。例: "hackernews"、"qiita"
  externalId: hit["objectID"],   // 取得元が記事に付けた ID。dedup キーは `${source}:${externalId}`
  title: hit["title"],        // 記事や投稿のタイトル
  url: hit["url"] ?? null,   // 記事の URL。HN の self-post（Ask HN 等）は URL がないため null
  tags: [],       // 技術タグの一覧。Qiita は tags[].name、タグのない HN は []
  popularity: hit["points"],   // 取得元内での人気度。HN は points、Qiita は likes_count
  publishedAt: new Date(hit["created_at_i"] * 1000).toISOString(),  // 公開日時。UTC の ISO 8601 形式へ正規化する
  locale: "global"       // 主な地域・言語圏。HN は "global"、Qiita は "jp"
};
}

// TODO(Day1-4): Qiita /items の 1 記事 → SpikeItem
// ヒント: created_at は "+09:00" 付き ISO 文字列。new Date(s).toISOString() で UTC になる
//         tags は [{ name, versions }] の配列 → name だけ取り出す。popularity は likes_count
export function fromQiitaItem(item: any): SpikeItem {
  return {
  source:"qiita",       // 取得元。例: "hackernews"、"qiita"
  externalId: item["id"],   // 取得元が記事に付けた ID。dedup キーは `${source}:${externalId}`
  title: item["title"],        // 記事や投稿のタイトル
  url: item["url"],   // 記事の URL。HN の self-post（Ask HN 等）は URL がないため null
  tags: item["tags"].map((x:any ) => x.name),       // 技術タグの一覧。Qiita は tags[].name、タグのない HN は []
  popularity: item["likes_count"],   // 取得元内での人気度。HN は points、Qiita は likes_count
  publishedAt: new Date(item["created_at"]).toISOString(),  // 公開日時。UTC の ISO 8601 形式へ正規化する
  locale: "jp"       // 主な地域・言語圏。HN は "global"、Qiita は "jp"
};
}

// 出現（occurrence）= 用語 × 文書。BigQuery occurrences 相当（spike はメモリ + JSON）
export interface Occurrence {
  termSlug: string;        // 検出した技術用語の識別名。例: "typescript"
  source: Source;          // 技術用語が見つかったデータの取得元
  docId: string;           // 元文書を一意に識別する `${source}:${externalId}`
  day: string;             // 用語が出現した UTC 日付。publishedAt から "YYYY-MM-DD" で作る
  locale: Locale;          // 用語が出現したデータの地域・言語圏
  where: "tag" | "title"; // 用語をタグから検出したか、タイトルから検出したか
}
