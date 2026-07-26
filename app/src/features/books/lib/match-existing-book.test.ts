import { describe, expect, test } from "vite-plus/test";
import { findBookCandidates, normalizeBookTitle } from "@/features/books/lib/match-existing-book";
import type { BookRowValues } from "@/features/books/schemas/book-schema";

function row(title: BookRowValues["title"], id = title): BookRowValues {
  return {
    id,
    pageUrl: `https://notion.so/${id}`,
    coverUrl: null,
    title,
    authors: [],
    status: null,
    amazonUrl: null,
    kindleLink: null,
    highlightCount: 0,
    lastUpdated: null,
  };
}

describe("normalizeBookTitle", () => {
  test("`: 副題` を落とす（Glasp 側と副題の有無が食い違うため）", () => {
    expect(normalizeBookTitle("アート・オブ・スペンディングマネー: １度きりの人生で")).toBe(
      "アート・オブ・スペンディングマネー",
    );
  });

  test("全角コロンも NFKC で半角に寄って副題として落ちる", () => {
    expect(normalizeBookTitle("書名：　副題")).toBe("書名");
  });

  test("コロンの後に空白が無い場合は副題扱いしない", () => {
    expect(normalizeBookTitle("C++:the language")).toBe("c++:the language");
  });

  test("連続空白の圧縮と casefold", () => {
    expect(normalizeBookTitle("  Effective   TypeScript  ")).toBe("effective typescript");
  });

  test("全角英数は NFKC で半角に寄る", () => {
    expect(normalizeBookTitle("ＴｙｐｅＳｃｒｉｐｔ")).toBe("typescript");
  });
});

describe("findBookCandidates", () => {
  const rows = [
    row("アート・オブ・スペンディングマネー"),
    row("世界一流エンジニアの思考法"),
    row("Effective TypeScript"),
  ];

  test("副題つきのペーストが副題なしの既存ページに一致する", () => {
    const candidates = findBookCandidates(
      "アート・オブ・スペンディングマネー: １度きりの人生で「お金」をどう使うべきか？",
      rows,
    );

    expect(candidates.map((c) => c.id)).toEqual(["アート・オブ・スペンディングマネー"]);
  });

  test("表記ゆれ（全角・余分な空白）でも一致する", () => {
    expect(findBookCandidates("effective  typescript", rows)).toHaveLength(1);
  });

  test("一致が無ければ空配列（UI は新規作成のまま）", () => {
    expect(findBookCandidates("存在しない本", rows)).toEqual([]);
  });

  test("同名が複数あれば全部返す（UI は自動選択しない）", () => {
    const duplicated = [...rows, row("Effective TypeScript", "dup")];

    expect(findBookCandidates("Effective TypeScript", duplicated)).toHaveLength(2);
  });

  test("空タイトルでは一致させない（全件マッチを防ぐ）", () => {
    expect(findBookCandidates("   ", rows)).toEqual([]);
  });
});
