import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import * as v from "valibot";
import { authMiddleware } from "@/lib/auth-middleware";
import { BookSyncError } from "@/features/books/errors";
import type { ImportFileResult } from "@/features/books/types/import-result";
import { findOrCreateDatabase } from "~/create-database";
import { parseMdContent } from "~/parse-md";
import { getPrimaryDataSourceId } from "~/lib/notion-data-source";
import { getAsinPageMap, syncBook } from "~/lib/notion-sync";

const importInput = v.object({
  files: v.array(v.object({ name: v.string(), content: v.string() })),
});

/**
 * md ファイル群を parse して Notion に create-or-append（サーバー専用）。
 * Notion レート制限を尊重して 1 冊ずつ逐次処理する。
 */
export const importBooksFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(importInput)
  .handler(async ({ data }) => {
    const databaseId = await findOrCreateDatabase();
    const dataSourceId = await getPrimaryDataSourceId(databaseId);
    const asinPageMap = await getAsinPageMap(databaseId);

    const results: ImportFileResult[] = [];
    for (const [index, f] of data.files.entries()) {
      // 同名ファイルでも List のキーが衝突しないよう、並び順を id に混ぜる
      const identity = { id: `${index}:${f.name}`, file: f.name };

      // 投げる Notion SDK / parse を境界で Result に包む
      const synced = await Result.tryPromise({
        try: () => {
          const book = parseMdContent(f.content, f.name);
          return syncBook(book, { dataSourceId, asinPageMap });
        },
        catch: (cause) =>
          new BookSyncError({
            cause,
            file: f.name,
            message: cause instanceof Error ? cause.message : String(cause),
          }),
      });

      // Result はシリアライズ境界を越えないよう plain object に変換
      if (Result.isError(synced)) {
        results.push({ ...identity, kind: "failed", error: synced.error.message });
        continue;
      }

      const r = synced.value;

      switch (r.kind) {
        case "created":
        case "updated":
          results.push({ ...identity, kind: r.kind, added: r.added });
          break;

        case "unchanged":
          results.push({ ...identity, kind: "unchanged" });
          break;

        // ASIN の無い md は syncBook が同期せず返す。結果に出さないと処理件数が合わなくなる
        case "skipped":
          results.push({ ...identity, kind: "skipped", reason: r.reason });
          break;
      }
    }

    return { results };
  });
