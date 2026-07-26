import * as v from "valibot";

/** メンタルマップの 1 問（H3 見出しの質問とその配下の答え群）。id は由来ブロック id。 */
const mentalMapItemSchema = v.object({
  id: v.string(),
  question: v.string(),
  answers: v.array(v.object({ id: v.string(), text: v.string() })),
});

/**
 * 詳細ページが受け取る形。getBookDetailFn の戻り値をここで検証してから返すことで、
 * クライアント側の型が `~/get-book-highlights`（＝ Notion CLI スタック）に依存しなくなる。
 */
export const bookDetailSchema = v.object({
  // Notion の quote ブロック + 子 bullet から復元した 1 ハイライト
  highlights: v.array(v.object({ id: v.string(), quote: v.string(), notes: v.array(v.string()) })),
  mentalMap: v.array(mentalMapItemSchema),
});

export type MentalMapItemValues = v.InferOutput<typeof mentalMapItemSchema>;
