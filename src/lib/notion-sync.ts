import { chunkNotionChildren } from '~/lib/notion-batch';
import { notion, withRetry } from '~/notion-client';
import { buildQuoteBlock, importBook } from '~/import-book';
import {
  getPrimaryDataSourceId,
  pageFromQueryResult,
  queryDataSourcePages,
  type DataSourceId,
} from '~/lib/notion-data-source';
import type { AppendHighlightsParams, Book, DatabaseId, Highlight, PageId } from '~/types';

export function normalizeQuoteText(s: Highlight['text']) {
  return s.replace(/\s+/g, ' ').trim();
}

export async function getAsinPageMap(databaseId: DatabaseId) {
  const map = new Map<string, PageId>();
  const dataSourceId = await getPrimaryDataSourceId(databaseId);
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
        const asin = prop.rich_text[0]?.plain_text;
        if (asin) map.set(asin, page.id);
      }
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return map;
}

export async function getExistingQuoteTexts(pageId: PageId) {
  const texts = new Set<string>();
  let cursor: string | undefined;
  do {
    const res = await withRetry(() =>
      notion.blocks.children.list({
        block_id: pageId,
        ...(cursor ? { start_cursor: cursor } : {}),
        page_size: 100,
      }),
    );
    for (const block of res.results) {
      if (!('type' in block) || block.type !== 'quote') continue;
      if (!('quote' in block)) continue;
      const text = block.quote.rich_text.map((rt: { plain_text: string }) => rt.plain_text).join('');
      texts.add(normalizeQuoteText(text));
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return texts;
}

export async function appendHighlights(...params: AppendHighlightsParams) {
  const [pageId, newHighlights] = params;
  const blocks = newHighlights.map(buildQuoteBlock);
  for (const batch of chunkNotionChildren(blocks)) {
    await withRetry(() =>
      notion.blocks.children.append({
        block_id: pageId,
        children: batch as Parameters<typeof notion.blocks.children.append>[0]['children'],
      }),
    );
  }
}

/** UI アップロード 1 冊分の create-or-append 結果。 */
export type SyncBookResult =
  | { kind: 'created'; pageId: PageId; added: number }
  | { kind: 'updated'; pageId: PageId; added: number }
  | { kind: 'unchanged'; pageId: PageId }
  | { kind: 'skipped'; reason: string };

/**
 * 1 冊を Notion に同期する。新規=作成、既存=未登録ハイライトのみ差分追記。
 * 読了ステータス / cover / 著者 は既存ページを尊重して触らない（ユーザー手編集の保護）。
 */
export async function syncBook(
  book: Book,
  ctx: { dataSourceId: DataSourceId; asinPageMap: Map<string, PageId> },
): Promise<SyncBookResult> {
  if (!book.asin) return { kind: 'skipped', reason: 'ASIN なし' };

  const existingPageId = ctx.asinPageMap.get(book.asin);

  if (!existingPageId) {
    const pageId = await importBook(book, ctx.dataSourceId);
    ctx.asinPageMap.set(book.asin, pageId);
    return { kind: 'created', pageId, added: book.highlights.length };
  }

  const existingTexts = await getExistingQuoteTexts(existingPageId);
  const newHighlights = book.highlights.filter(
    (h) => !existingTexts.has(normalizeQuoteText(h.text)),
  );

  if (newHighlights.length === 0) return { kind: 'unchanged', pageId: existingPageId };

  await appendHighlights(existingPageId, newHighlights);
  await withRetry(() =>
    notion.pages.update({
      page_id: existingPageId,
      properties: {
        ハイライト件数: { number: book.highlights.length },
        ...(book.lastUpdated ? { 最終更新日: { date: { start: book.lastUpdated } } } : {}),
      },
    }),
  );
  return { kind: 'updated', pageId: existingPageId, added: newHighlights.length };
}
