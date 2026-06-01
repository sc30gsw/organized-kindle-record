import { createServerFn } from "@tanstack/react-start";
import { ensureSession } from "@/lib/auth-functions";
import { listBooks } from "~/list-books";

/** Notion DB の全ページを一覧行として返す（サーバー専用：handler 内は client に出ない）。 */
export const listBooksFn = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSession();
  return listBooks();
});
