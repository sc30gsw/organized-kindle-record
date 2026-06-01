import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";
import { ensureSession } from "@/lib/auth-functions";
import { getBookHighlights } from "~/get-book-highlights";

const input = v.object({ bookId: v.string() });

/** 1 冊分のハイライト（引用 + メモ）を Notion ページから取得する。 */
export const getBookDetailFn = createServerFn({ method: "GET" })
  .inputValidator(input)
  .handler(async ({ data }) => {
    await ensureSession();
    return getBookHighlights(data.bookId);
  });
