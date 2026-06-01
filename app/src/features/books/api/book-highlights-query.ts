import { queryOptions } from "@tanstack/react-query";
import { getBookDetailFn } from "@/features/books/server/get-book-detail-fn";
import type { RegisteredRouter, RouteById } from "@tanstack/react-router";

/** 詳細ページのハイライト取得用 queryOptions。route loader の ensureQueryData と Suspense 双方で使う。 */
export function bookHighlightsQueryOptions(
  bookId: RouteById<
    RegisteredRouter["routeTree"],
    "/_authenticated/books/$bookId"
  >["types"]["params"],
) {
  return queryOptions({
    queryKey: ["book-highlights", bookId],
    queryFn: () => getBookDetailFn({ data: { bookId } }),
  });
}
