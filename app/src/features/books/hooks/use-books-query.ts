import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { eq } from "@tanstack/db";
import { getRouteApi } from "@tanstack/react-router";
import { booksCollection } from "@/features/books/collections";

const routeApi = getRouteApi("/_authenticated/");

/**
 * 読了ステータスは DB の where で、テキスト(title/author の OR)は JS で絞り込む。
 * authors は配列のため live query の like では表現しづらく、JS フィルタが素直。
 */
export function useBooksQuery() {
  const search = routeApi.useSearch();
  const needle = (search.q ?? "").trim().toLowerCase();
  const status = search.status;

  const { data } = useLiveSuspenseQuery(
    (query) => {
      let result = query.from({ book: booksCollection });

      if (status) {
        result = result.where(({ book }) => eq(book.status, status));
      }

      return result;
    },
    [status],
  );

  if (!needle) {
    return data;
  }

  return data.filter(
    (b) =>
      b.title.toLowerCase().includes(needle) ||
      b.authors.some((a) => a.toLowerCase().includes(needle)),
  );
}
