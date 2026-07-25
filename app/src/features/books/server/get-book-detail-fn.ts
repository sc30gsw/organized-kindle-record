import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";
import { authMiddleware } from "@/lib/auth-middleware";
import { getBookHighlights } from "~/get-book-highlights";

const input = v.object({ bookId: v.string() });

/** 1 冊分のハイライト（引用 + メモ）を Notion ページから取得する。 */
export const getBookDetailFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(input)
  .handler(async ({ data }) => getBookHighlights(data.bookId));
