import { queryOptions } from "@tanstack/react-query";
import { getBookDetailFn } from "@/features/books/server/get-book-detail-fn";
import type { RegisteredRouter, RouteById } from "@tanstack/react-router";

/** 詳細ページのハイライト取得用 queryOptions。CSR 明示のため Suspense からのみ使う。 */
export function bookHighlightsQueryOptions(
  bookId: RouteById<
    RegisteredRouter["routeTree"],
    "/_authenticated/books/$bookId"
  >["types"]["params"]["bookId"],
) {
  return queryOptions({
    queryKey: ["book-highlights", bookId],
    queryFn: () => getBookDetailFn({ data: { bookId } }),
  });
}
