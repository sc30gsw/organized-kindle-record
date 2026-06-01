import { notion, withRetry } from '~/notion-client';
import { chunkNotionChildren } from '~/lib/notion-batch';
import { chunkText } from '~/lib/text';
import { HIGHLIGHTS_SECTION_TITLE, READING_STATUS_DONE } from '~/types/constants';
import type { DataSourceId } from '~/lib/notion-data-source';
import type { Book, Highlight } from '~/types';

type RichText = { type: 'text'; text: Record<'content', string> };
type BulletBlock = {
  type: 'bulleted_list_item';
  bulleted_list_item: Record<'rich_text', RichText[]>;
};
type QuoteBlock = {
  type: 'quote';
  quote: { rich_text: RichText[]; children?: BulletBlock[] };
};
type HeadingBlock = {
  type: 'heading_3';
  heading_3: Record<'rich_text', RichText[]>;
};
type AnyBlock = QuoteBlock | BulletBlock | HeadingBlock;

type NotionPageCreateChildren = NonNullable<Parameters<typeof notion.pages.create>[0]['children']>;
type NotionBlockAppendChildren = NonNullable<
  Parameters<typeof notion.blocks.children.append>[0]['children']
>;

function toRichText(text: Highlight['text']) {
  return chunkText(text).map((c) => ({ type: 'text', text: { content: c } }) satisfies RichText);
}

export function buildQuoteBlock(...[h]: [Highlight]) {
  const children = h.notes.map(
    (note) =>
      ({
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: toRichText(note) },
      }) satisfies BulletBlock,
  );

  return {
    type: 'quote',
    quote: {
      rich_text: toRichText(h.text),
      ...(children.length > 0 ? { children } : {}),
    },
  } satisfies QuoteBlock;
}

function buildBlocks(book: Book) {
  const heading = {
    type: 'heading_3',
    heading_3: {
      rich_text: [{ type: 'text', text: { content: HIGHLIGHTS_SECTION_TITLE } } satisfies RichText],
    },
  } satisfies HeadingBlock;
  const quotes = book.highlights.map(buildQuoteBlock);
  return [heading, ...quotes] as const satisfies readonly AnyBlock[];
}

export async function importBook(
  ...[book, dataSourceId]: [book: Book, dataSourceId: DataSourceId]
) {
  const allBlocks = [...buildBlocks(book)];
  const [firstBatch = [], ...restBatches] = chunkNotionChildren(allBlocks);

  // ページを作成（最初の 100 ブロックまで）
  const page = await withRetry(() =>
    notion.pages.create({
      parent: { type: 'data_source_id', data_source_id: dataSourceId },
      ...(book.coverUrl
        ? { cover: { type: 'external', external: { url: book.coverUrl } } as const }
        : {}),
      properties: {
        タイトル: { title: toRichText(book.title) },
        著者: { multi_select: book.authors.map((a) => ({ name: a })) },
        ...(book.asin ? { ASIN: { rich_text: toRichText(book.asin) } } : {}),
        ...(book.bookUrl ? { 'Amazon URL': { url: book.bookUrl } } : {}),
        ...(book.kindleLink ? { 'Kindle Link': { url: book.kindleLink } } : {}),
        ...(book.lastUpdated ? { 最終更新日: { date: { start: book.lastUpdated } } } : {}),
        ハイライト件数: { number: book.highlights.length },
        読了ステータス: { select: { name: READING_STATUS_DONE } },
        ...(book.coverUrl ? { 'Cover URL': { url: book.coverUrl } } : {}),
      },
      children: firstBatch as NotionPageCreateChildren,
    }),
  );

  // 残りブロックを 100 件ずつ追記
  for (const batch of restBatches) {
    await withRetry(() =>
      notion.blocks.children.append({
        block_id: page.id,
        children: batch as NotionBlockAppendChildren,
      }),
    );
  }

  return page.id;
}
