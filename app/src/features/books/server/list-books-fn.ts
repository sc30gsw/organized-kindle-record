import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth-middleware";
import { listBooks } from "~/list-books";

/** Notion DB の全ページを一覧行として返す（サーバー専用：handler 内は client に出ない）。 */
export const listBooksFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => listBooks());
