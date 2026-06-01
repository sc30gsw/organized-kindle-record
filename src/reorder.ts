import { readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { orderBy } from 'es-toolkit';
import pLimit from 'p-limit';
import { lastUpdatedSortKey } from '~/lib/glasp-date';
import {
  getPrimaryDataSourceId,
  pageFromQueryResult,
  queryDataSourcePages,
  type DataSourceId,
} from '~/lib/notion-data-source';
import { notion, withRetry } from '~/notion-client';
import { findOrCreateDatabase } from '~/create-database';
import { parseMd } from '~/parse-md';
import { importBook } from '~/import-book';
import type { Book, PageId } from '~/types';

const HIGHLIGHTS_DIR = resolve(process.cwd(), 'Glasp Kindle Highlights');

async function getAllPageIds(dataSourceId: DataSourceId) {
  const ids = [] as PageId[];
  let cursor: string | undefined;
  do {
    const res = await queryDataSourcePages(dataSourceId, { startCursor: cursor });
    for (const result of res.results) {
      const page = pageFromQueryResult(result);
      if (page) ids.push(page.id);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return ids;
}

async function main() {
  console.log('🔄 Reorder: 最終更新日 DESC で並び替え\n');

  const databaseId = await findOrCreateDatabase();

  // 1. 全ページ ID 取得
  console.log('既存ページを取得中...');
  const dataSourceId = await getPrimaryDataSourceId(databaseId);
  const pageIds = await getAllPageIds(dataSourceId);
  console.log(`  ${pageIds.length} 件\n`);

  // 2. 全ページをアーカイブ（並列5件）
  console.log('全ページをアーカイブ中...');
  const archiveLimit = pLimit(5);
  let archived = 0;
  await Promise.all(
    pageIds.map((id) =>
      archiveLimit(async () => {
        await withRetry(() => notion.pages.update({ page_id: id, archived: true }));
        archived++;
        if (archived % 50 === 0) console.log(`  ${archived}/${pageIds.length} 完了`);
      }),
    ),
  );
  console.log(`  完了: ${archived} 件アーカイブ\n`);

  // 3. mdファイルをパースして最終更新日 DESC でソート
  console.log('ファイルを最終更新日でソート中...');
  const files = readdirSync(HIGHLIGHTS_DIR).filter((f) => f.endsWith('.md'));
  const books = orderBy(
    files.map((f) => parseMd(join(HIGHLIGHTS_DIR, f))),
    [(b) => lastUpdatedSortKey(b.lastUpdated)],
    ['desc'],
  );

  console.log(`  最新: ${books[0]?.lastUpdated} — ${books[0]?.title.slice(0, 40)}`);
  console.log(
    `  最古: ${books[books.length - 1]?.lastUpdated} — ${books[books.length - 1]?.title.slice(0, 40)}\n`,
  );

  // 4. 日付順に1件ずつ再インポート（順序保証）
  console.log('日付順に再インポート中...');
  let done = 0;
  const failed: Book['filePath'][] = [];

  for (const book of books) {
    try {
      await importBook(book, dataSourceId);
      done++;
      process.stdout.write(
        `\r  ${done}/${books.length} ✅ ${book.lastUpdated ?? '----'} ${book.title.slice(0, 30).padEnd(30)}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n  ❌ ${book.title.slice(0, 40)} — ${msg}`);
      failed.push(book.filePath);
    }
  }

  console.log(`\n\n====================================`);
  console.log(`✅ 成功: ${done} 冊`);
  if (failed.length > 0) {
    console.log(`❌ 失敗: ${failed.length} 冊`);
    for (const f of failed) console.log(`   ${f}`);
  }
  console.log(`📊 DB: https://notion.so/${databaseId.replace(/-/g, '')}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
