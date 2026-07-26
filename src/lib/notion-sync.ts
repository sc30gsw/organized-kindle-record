import { chunkNotionChildren } from '~/lib/notion-batch';
import { notion, withRetry } from '~/notion-client';
import { buildQuoteBlock, importBook } from '~/import-book';
import {
  getPrimaryDataSourceId,
  pageFromQueryResult,
  queryDataSourcePages,
  type DataSourceId,
} from '~/lib/notion-data-source';
import type {
  AppendHighlightsParams,
  Book,
  DatabaseId,
  Highlight,
  PageId,
  ReadingStatusName,
} from '~/types';

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
      const text = block.quote.rich_text
        .map((rt: { plain_text: string }) => rt.plain_text)
        .join('');
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

  return appendNewHighlights(book, existingPageId);
}

/**
 * 既存ページへ未登録ハイライトのみ差分追記する（重複判定は引用テキストの正規化一致）。
 * ASIN を使わないため、ファイル取込とペースト取込で共有できる。
 */
async function appendNewHighlights(book: Book, pageId: PageId): Promise<SyncBookResult> {
  const existingTexts = await getExistingQuoteTexts(pageId);
  const newHighlights = book.highlights.filter(
    (h) => !existingTexts.has(normalizeQuoteText(h.text)),
  );

  if (newHighlights.length === 0) return { kind: 'unchanged', pageId };

  await appendHighlights(pageId, newHighlights);
  await withRetry(() =>
    notion.pages.update({
      page_id: pageId,
      properties: {
        ハイライト件数: { number: book.highlights.length },
        ...(book.lastUpdated ? { 最終更新日: { date: { start: book.lastUpdated } } } : {}),
      },
    }),
  );
  return { kind: 'updated', pageId, added: newHighlights.length };
}

/**
 * 取込先を明示して 1 冊を同期する（UI のペースト取込用）。
 *
 * Web Highlights の書き出しは ASIN を持たないので `syncBook` の ASIN 経路が使えない。
 * create を ASIN 無しで許すのはこの経路だけの意図的な緩和で、取込先の判断は UI 側が持つ。
 * append は引用テキスト一致で重複を弾くため、読み進めてから再ペーストすると差分だけ増える。
 * 既存ページの著者 / cover / 読了ステータスは触らない（手編集の保護）。
 */
export async function syncBookToPage(
  book: Book,
  ctx: {
    dataSourceId: DataSourceId;
    target: { kind: 'create' } | { kind: 'append'; pageId: PageId };
    status?: ReadingStatusName;
  },
): Promise<SyncBookResult> {
  if (ctx.target.kind === 'create') {
    const pageId = await importBook(book, ctx.dataSourceId, ctx.status);
    return { kind: 'created', pageId, added: book.highlights.length };
  }

  const { pageId } = ctx.target;
  const { asin, tags } = book;

  // 明示入力された ASIN / タグだけ書き戻す。ASIN が入れば以降は正規キーとして効く
  if (asin || tags.length > 0) {
    await withRetry(() =>
      notion.pages.update({
        page_id: pageId,
        properties: {
          ...(asin ? { ASIN: { rich_text: [{ type: 'text', text: { content: asin } }] } } : {}),
          ...(tags.length > 0 ? { タグ: { multi_select: tags.map((name) => ({ name })) } } : {}),
        },
      }),
    );
  }

  return appendNewHighlights(book, pageId);
}
