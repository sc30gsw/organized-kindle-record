import { readdirSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { findOrCreateDatabase } from '~/create-database';
import { parseMd } from '~/parse-md';
import {
  appendHighlights,
  getAsinPageMap,
  getExistingQuoteTexts,
  normalizeQuoteText,
} from '~/lib/notion-sync';
import { notion, withRetry } from '~/notion-client';

const HIGHLIGHTS_DIR = resolve(process.cwd(), 'Glasp Kindle Highlights');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const targetAsin = args.find((_, i) => args[i - 1] === '--asin');
const targetFile = args.find((_, i) => args[i - 1] === '--file');

async function main() {
  console.log(`\n🔄 差分ハイライト追記${dryRun ? ' [dry-run]' : ''}\n`);

  const databaseId = await findOrCreateDatabase();

  console.log('Notion DB からページ一覧を取得中...');
  const asinPageMap = await getAsinPageMap(databaseId);
  console.log(`  ${asinPageMap.size} 件のページを取得\n`);

  let files = readdirSync(HIGHLIGHTS_DIR).filter((f) => f.endsWith('.md'));
  if (targetFile) {
    files = files.filter((f) => f === targetFile || f === basename(targetFile));
  }

  let scanned = 0;
  let updated = 0;
  let totalAdded = 0;
  const skipped = [] as string[];
  const warned = [] as string[];

  for (const file of files) {
    const book = parseMd(join(HIGHLIGHTS_DIR, file));
    scanned++;

    if (!book.asin) {
      skipped.push(`${file} (ASIN なし)`);
      continue;
    }
    if (targetAsin && book.asin !== targetAsin) continue;

    const pageId = asinPageMap.get(book.asin);
    if (!pageId) {
      skipped.push(`${file} (Notion にページなし)`);
      continue;
    }

    const existingTexts = await getExistingQuoteTexts(pageId);

    if (existingTexts.size > book.highlights.length) {
      warned.push(
        `${book.title.slice(0, 40)} — Notion ${existingTexts.size} 件 > md ${book.highlights.length} 件`,
      );
    }

    const newHighlights = book.highlights.filter(
      (h) => !existingTexts.has(normalizeQuoteText(h.text)),
    );

    if (newHighlights.length === 0) continue;

    console.log(`  📖 ${book.title.slice(0, 40)} — +${newHighlights.length} 件`);

    if (!dryRun) {
      await appendHighlights(pageId, newHighlights);
      await withRetry(() =>
        notion.pages.update({
          page_id: pageId,
          properties: {
            ハイライト件数: { number: book.highlights.length },
          },
        }),
      );
    }

    updated++;
    totalAdded += newHighlights.length;
  }

  console.log(`\n====================================`);
  console.log(`📊 スキャン: ${scanned} 冊`);
  console.log(`✅ 更新${dryRun ? ' (予定)' : '済み'}: ${updated} 冊 (+${totalAdded} ハイライト)`);
  if (warned.length > 0) {
    console.log(`⚠️  Notion > md (削除なし):`);
    for (const w of warned) console.log(`   ${w}`);
  }
  if (skipped.length > 0) {
    console.log(`⏭️  スキップ: ${skipped.length} 件`);
    for (const s of skipped) console.log(`   ${s}`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
