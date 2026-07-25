import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";
import { authMiddleware } from "@/lib/auth-middleware";
import { bookDetailSchema } from "@/features/books/schemas/book-detail-schema";
import { getBookHighlights } from "~/get-book-highlights";

const input = v.object({ bookId: v.string() });

/**
 * 1 冊分のハイライト（引用 + メモ）を Notion ページから取得する。
 * 戻り値を境界で検証することで、クライアント側の型がサーバー専用モジュールへ辿らないようにする。
 */
export const getBookDetailFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(input)
  .handler(async ({ data }) => v.parse(bookDetailSchema, await getBookHighlights(data.bookId)));
