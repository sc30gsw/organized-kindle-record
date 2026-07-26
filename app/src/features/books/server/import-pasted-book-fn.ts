import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import { authMiddleware } from "@/lib/auth-middleware";
import { BookSyncError } from "@/features/books/errors";
import { importPastedBookSchema } from "@/features/books/schemas/paste-import-schema";
import type { ImportFileResult, ImportResultIdentity } from "@/features/books/types/import-result";
import { findOrCreateDatabase } from "~/create-database";
import { getPrimaryDataSourceId } from "~/lib/notion-data-source";
import { syncBookToPage } from "~/lib/notion-sync";
import { parseWebHighlights } from "~/parse-web-highlights";
import type { SyncBookResult } from "~/lib/notion-sync";

/** core の同期結果を UI の判別共用体へ写像する（class をそのまま境界へ出さない）。 */
function toImportResult(identity: ImportResultIdentity, r: SyncBookResult): ImportFileResult {
  switch (r.kind) {
    case "created":
    case "updated":
      return { ...identity, kind: r.kind, added: r.added };

    case "unchanged":
      return { ...identity, kind: "unchanged" };

    case "skipped":
      return { ...identity, kind: "skipped", reason: r.reason };
  }
}

/**
 * preview で確定した内容を Notion に反映する（サーバー専用）。
 *
 * client から Book を受け取らず、生テキストを再 parse してから override を重ねる。
 * parse は純粋で安価なので、client が組み立てた Book を信用する必要はない。
 * 読了ステータスは新規作成時のみ効く（既存ページの手編集を上書きしない）。
 */
export const importPastedBookFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(importPastedBookSchema)
  .handler(async ({ data }) => {
    const { overrides, target } = data;

    const synced = await Result.tryPromise({
      try: async () => {
        const { book } = parseWebHighlights(data.content);
        const merged = {
          ...book,
          title: overrides.title,
          authors: overrides.authors,
          // 空文字は「未入力」。Notion に空プロパティを作らない
          asin: overrides.asin || null,
          tags: overrides.tags,
          lastUpdated: overrides.lastUpdated,
        };

        const databaseId = await findOrCreateDatabase();
        const dataSourceId = await getPrimaryDataSourceId(databaseId);

        return syncBookToPage(merged, {
          dataSourceId,
          target,
          ...(overrides.status ? { status: overrides.status } : {}),
        });
      },
      catch: (cause) =>
        new BookSyncError({
          cause,
          file: overrides.title,
          message: cause instanceof Error ? cause.message : String(cause),
        }),
    });

    // Result はシリアライズ境界を越えないよう plain object へ変換する
    const identity: ImportResultIdentity = {
      id: `paste:${overrides.title}`,
      file: overrides.title,
    };
    const result: ImportFileResult = Result.isError(synced)
      ? { ...identity, kind: "failed", error: synced.error.message }
      : toImportResult(identity, synced.value);

    return { result };
  });
