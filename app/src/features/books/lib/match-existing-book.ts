import type { BookRowValues } from "@/features/books/schemas/book-schema";

/**
 * 取込先の自動判定に使うタイトル正規化。
 *
 * NFKC → `: 副題` の除去 → 連続空白の圧縮 → trim → casefold。
 * 副題を落とすのは、Kindle notebook 由来のタイトルと Glasp 由来の既存ページで
 * 副題の有無が食い違うため（全角コロンは NFKC で半角に寄る）。
 */
export function normalizeBookTitle(title: BookRowValues["title"]) {
  return title
    .normalize("NFKC")
    .replace(/\s*:\s[\s\S]*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * ペーストされたタイトルに一致する既存ページを返す。
 *
 * ここが「重複ページを作るかどうか」を直接決めるので、候補が 1 件のときだけ
 * UI が自動選択し、複数件なら選ばせる（呼び出し側の責務）。
 */
export function findBookCandidates(title: BookRowValues["title"], rows: readonly BookRowValues[]) {
  const needle = normalizeBookTitle(title);

  if (!needle) {
    return [];
  }

  return rows.filter((row) => normalizeBookTitle(row.title) === needle);
}
