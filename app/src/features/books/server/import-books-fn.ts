import { createServerFn } from '@tanstack/react-start';
import { Result } from 'better-result';
import * as v from 'valibot';
import { ensureSession } from '@/lib/auth-functions';
import { BookSyncError } from '@/features/books/errors';
import { findOrCreateDatabase } from '~/create-database';
import { parseMdContent } from '~/parse-md';
import { getPrimaryDataSourceId } from '~/lib/notion-data-source';
import { getAsinPageMap, syncBook } from '~/lib/notion-sync';

const importInput = v.object({
  files: v.array(v.object({ name: v.string(), content: v.string() })),
});

type ImportInput = v.InferInput<typeof importInput>;

/** アップロード 1 ファイルぶんの結果（例外は投げず判別共用体で返す）。 */
export type ImportFileResult =
  | { file: ImportInput['files'][number]['name']; kind: 'created'; added: number }
  | { file: ImportInput['files'][number]['name']; kind: 'updated'; added: number }
  | { file: ImportInput['files'][number]['name']; kind: 'unchanged' }
  | { file: ImportInput['files'][number]['name']; kind: 'skipped'; reason: string }
  | { file: ImportInput['files'][number]['name']; kind: 'failed'; error: string };

/**
 * md ファイル群を parse して Notion に create-or-append（サーバー専用）。
 * Notion レート制限を尊重して 1 冊ずつ逐次処理する。
 */
export const importBooksFn = createServerFn({ method: 'POST' })
  .inputValidator(importInput)
  .handler(async ({ data }) => {
    await ensureSession();
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

      switch (r.kind) {
        case 'created':
        case 'updated':
          results.push({ file: f.name, kind: r.kind, added: r.added });
          break;

        case 'unchanged':
          results.push({ file: f.name, kind: 'unchanged' });
          break;
      }
    }

    return { results };
  });
