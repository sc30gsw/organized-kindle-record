import { createServerFn } from "@tanstack/react-start";
import { toReadingStatus } from "@/features/books/schemas/book-schema";
import { authMiddleware } from "@/lib/auth-middleware";
import { listBooks } from "~/list-books";

/** Notion DB の全ページを一覧行として返す（サーバー専用：handler 内は client に出ない）。 */
export const listBooksFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const books = await listBooks();

    // 読了ステータスは Notion 側で選択肢を増やせるため、既知の値だけに正規化して返す
    return books.map((book) => ({ ...book, status: toReadingStatus(book.status) }));
  });
