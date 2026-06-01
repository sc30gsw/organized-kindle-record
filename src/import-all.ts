import { readdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import pLimit from 'p-limit';
import { findOrCreateDatabase } from '~/create-database';
import { parseMd } from '~/parse-md';
import { importBook } from '~/import-book';
import {
  getPrimaryDataSourceId,
  pageFromQueryResult,
  queryDataSourcePages,
  type DataSourceId,
} from '~/lib/notion-data-source';
import type { Book, FailedEntry } from '~/types';

const HIGHLIGHTS_DIR = resolve(process.cwd(), 'Glasp Kindle Highlights');
const CONCURRENCY = 3;

// Pilot files（バリエーション確認用）
const PILOT_FILES = [
  '世界一流エンジニアの思考法 (文春e-book).md',
  '限りある時間の使い方.md',
  '良いコード／悪いコードで学ぶ設計入門―保守しやすい　成長し続けるコードの書き方.md',
  '銃・病原菌・鉄　下巻.md',
] as const satisfies readonly Book['filePath'][];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const pilot = args.includes('--pilot');
const limitIdx = args.indexOf('--limit');
const maxBooks = limitIdx >= 0 ? parseInt(args[limitIdx + 1] ?? '9999', 10) : Infinity;

async function getExistingAsins(dataSourceId: DataSourceId) {
  const asins = new Set<string>();
  let cursor: string | undefined;

  do {
    const res = await queryDataSourcePages(dataSourceId, {
      filterProperties: ['ASIN'],
      startCursor: cursor,
    });

    for (const result of res.results) {
      const page = pageFromQueryResult(result);
      if (!page) continue;
      const prop = page.properties['ASIN'];
      if (prop?.type === 'rich_text' && Array.isArray(prop.rich_text)) {
        const text = prop.rich_text[0]?.plain_text;
        if (text) asins.add(text);
      }
    }

    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return asins;
}

async function main() {
  console.log(`\n📚 Kindle 読書記録 インポーター`);
  console.log(`   mode: ${dryRun ? 'dry-run' : pilot ? 'pilot (4冊)' : '全件'}\n`);

  // ファイル一覧
  let files = readdirSync(HIGHLIGHTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .toSorted();

  if (pilot) {
    files = PILOT_FILES.filter((f) => files.includes(f));
    const missing = PILOT_FILES.filter((f) => !files.includes(f));
    if (missing.length > 0) {
      console.warn(`⚠️  Pilot ファイル未発見: ${missing.join(', ')}`);
    }
  }

  if (isFinite(maxBooks)) files = files.slice(0, maxBooks);

  console.log(`対象ファイル: ${files.length} 冊`);

  // Dry-run: パースして JSON 出力
  if (dryRun) {
    const books = files.map((f) => parseMd(join(HIGHLIGHTS_DIR, f)));
    writeFileSync('parsed.json', JSON.stringify(books, null, 2), 'utf-8');
    console.log(`\n✅ parsed.json に出力しました (${books.length} 冊)`);

    // サマリ表示
    const noAsin = books.filter((b) => !b.asin);
    const noHighlights = books.filter((b) => b.highlights.length === 0);
    const multiAuthor = books.filter((b) => b.authors.length > 1);
    console.log(`   ハイライト件数 0: ${noHighlights.length} 冊`);
    console.log(`   ASIN なし: ${noAsin.length} 冊`);
    console.log(`   共著: ${multiAuthor.length} 冊`);
    if (noAsin.length > 0) {
      console.log(`   ASIN なしのタイトル: ${noAsin.map((b) => b.title).join(', ')}`);
    }
    return;
  }

  // DB 作成 or 既存取得
  const databaseId = await findOrCreateDatabase();
  console.log(`\nDB ID: ${databaseId}`);

  // 既存 ASIN を取得（再実行時の重複防止）
  console.log('既存レコードを確認中...');
  const dataSourceId = await getPrimaryDataSourceId(databaseId);
  const existingAsins = await getExistingAsins(dataSourceId);
  console.log(`  既存: ${existingAsins.size} 件`);

  // インポート対象を絞り込み
  const allBooks = files.map((f) => parseMd(join(HIGHLIGHTS_DIR, f)));
  const toImport = allBooks.filter((b) => !b.asin || !existingAsins.has(b.asin));
  const skipped = allBooks.length - toImport.length;

  console.log(`  スキップ (既存): ${skipped} 冊`);
  console.log(`  インポート対象: ${toImport.length} 冊\n`);

  if (toImport.length === 0) {
    console.log('✅ すべてインポート済みです。');
    return;
  }

  // 並列インポート
  const limit = pLimit(CONCURRENCY);
  const failed: Book['filePath'][] = [];
  let done = 0;

  await Promise.all(
    toImport.map((book) =>
      limit(async () => {
        try {
          await importBook(book, dataSourceId);
          done++;
          const pct = Math.round((done / toImport.length) * 100);
          console.log(`  [${done}/${toImport.length}] (${pct}%) ✅ ${book.title.slice(0, 40)}`);
          appendFileSync('done.log', `${book.filePath}\n`, 'utf-8');
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`  ❌ ${book.title.slice(0, 40)} — ${msg}`);
          failed.push(book.filePath);
          const entry = { file: book.filePath, error: msg } satisfies FailedEntry;
          appendFileSync('failed.json', JSON.stringify(entry) + '\n', 'utf-8');
        }
      }),
    ),
  );

  console.log(`\n====================================`);
  console.log(`✅ 成功: ${done} 冊`);
  if (failed.length > 0) {
    console.log(`❌ 失敗: ${failed.length} 冊 → failed.json を確認してください`);
  }
  console.log(`📊 DB: https://notion.so/${databaseId.replace(/-/g, '')}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
