import { createServerFn } from '@tanstack/react-start';
import { Result } from 'better-result';
import * as v from 'valibot';
import { BookSyncError } from '@/features/books/errors';

const importInput = v.object({
  files: v.array(v.object({ name: v.string(), content: v.string() })),
});

/** アップロード 1 ファイルぶんの結果（例外は投げず判別共用体で返す）。 */
export type ImportFileResult =
  | { file: string; kind: 'created'; added: number }
  | { file: string; kind: 'updated'; added: number }
  | { file: string; kind: 'unchanged' }
  | { file: string; kind: 'skipped'; reason: string }
  | { file: string; kind: 'failed'; error: string };

/**
 * md ファイル群を parse して Notion に create-or-append（サーバー専用）。
 * Notion レート制限を尊重して 1 冊ずつ逐次処理する。
 */
export const importBooksFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => v.parse(importInput, input))
  .handler(async ({ data }): Promise<{ results: ImportFileResult[] }> => {
    const { parseMdContent } = await import('~/parse-md');
    const { findOrCreateDatabase } = await import('~/create-database');
    const { getPrimaryDataSourceId } = await import('~/lib/notion-data-source');
    const { getAsinPageMap, syncBook } = await import('~/lib/notion-sync');

    const databaseId = await findOrCreateDatabase();
    const dataSourceId = await getPrimaryDataSourceId(databaseId);
    const asinPageMap = await getAsinPageMap(databaseId);

    const results: ImportFileResult[] = [];
    for (const f of data.files) {
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
        results.push({ file: f.name, kind: 'failed', error: synced.error.message });
        continue;
      }

      const r = synced.value;
      if (r.kind === 'created' || r.kind === 'updated') {
        results.push({ file: f.name, kind: r.kind, added: r.added });
      } else if (r.kind === 'unchanged') {
        results.push({ file: f.name, kind: 'unchanged' });
      } else {
        results.push({ file: f.name, kind: 'skipped', reason: r.reason });
      }
    }
    return { results };
  });
