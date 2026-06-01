import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { queryClient } from "@/lib/query-client";
import { bookRowSchema } from "@/features/books/schemas/book-schema";
import { listBooksFn } from "@/features/books/server/list-books-fn";

/** Notion 由来の本一覧（読み取り中心）。アップロードは collection 経由でなく refetch で反映。 */
export const booksCollection = createCollection(
  queryCollectionOptions({
    queryClient,
    queryKey: ["books"],
    queryFn: () => listBooksFn(),
    getKey: (item) => item.id,
    schema: bookRowSchema,
  }),
);
