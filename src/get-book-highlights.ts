import { BlockObjectResponse } from "@notionhq/client";
import { notion, withRetry } from "~/notion-client";
import { Highlight, PageId } from "~/types";

/** 1 ハイライト分の表示用データ（引用 + メモ群）。Notion の quote ブロックと子 bullet から復元。 */
export type BookHighlight = {
  quote: string;
  notes: Highlight["notes"];
};

/** ページ詳細の取得結果。ハイライトと「メンタルマップ」(H2 セクション) のテキスト行。 */
export type BookDetail = {
  highlights: BookHighlight[];
  mentalMap: string[];
};

const MENTAL_MAP_HEADING = "メンタルマップ";

function richTextToPlain(richText: Record<"plain_text", string>[]) {
  return richText.map((rt) => rt.plain_text).join("");
}

/** テキストを持つブロックから本文を取り出す（対象外の型は null）。 */
function blockText(block: BlockObjectResponse): string | null {
  switch (block.type) {
    case "paragraph":
      return richTextToPlain(block.paragraph.rich_text) || null;

    case "bulleted_list_item":
      return richTextToPlain(block.bulleted_list_item.rich_text) || null;

    case "numbered_list_item":
      return richTextToPlain(block.numbered_list_item.rich_text) || null;

    case "quote":
      return richTextToPlain(block.quote.rich_text) || null;

    case "to_do":
      return richTextToPlain(block.to_do.rich_text) || null;

    case "callout":
      return richTextToPlain(block.callout.rich_text) || null;

    case "heading_3":
      return richTextToPlain(block.heading_3.rich_text) || null;

    default:
      return null;
  }
}

/** ブロックの子をページング込みで全件取得する。 */
async function listAllChildren(blockId: PageId) {
  const blocks: BlockObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const res = await withRetry(() =>
      notion.blocks.children.list({
        block_id: blockId,
        ...(cursor ? { start_cursor: cursor } : {}),
        page_size: 100,
      }),
    );
    blocks.push(...(res.results as BlockObjectResponse[]));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return blocks;
}

/**
 * Notion ページから読書ハイライト（quote + 子 bullet メモ）と
 * 「メンタルマップ」H2 セクションのテキストを復元する。
 * H2「メンタルマップ」以降の兄弟ブロックを、次の H1/H2 が現れるまで本文として収集する。
 */
export async function getBookHighlights(pageId: PageId): Promise<BookDetail> {
  const topBlocks = await listAllChildren(pageId);
  const highlights: BookHighlight[] = [];
  const mentalMap: string[] = [];
  let inMentalMap = false;

  for (const block of topBlocks) {
    if (!("type" in block)) {
      continue;
    }

    // H1/H2 はセクション境界。「メンタルマップ」見出しのときだけ収集を開始する。
    if (block.type === "heading_1" || block.type === "heading_2") {
      const headingText =
        block.type === "heading_2" ? richTextToPlain(block.heading_2.rich_text).trim() : "";
      inMentalMap = headingText === MENTAL_MAP_HEADING;
      continue;
    }

    if (inMentalMap) {
      const text = blockText(block);
      if (text) {
        mentalMap.push(text);
      }

      if (block.has_children) {
        const children = await listAllChildren(block.id);

        for (const child of children) {
          const childText = blockText(child);
          if (childText) {
            mentalMap.push(childText);
          }
        }
      }
      continue;
    }

    if (block.type !== "quote") continue;

    const quote = richTextToPlain(block.quote.rich_text);
    const notes: Highlight["notes"][number][] = [];

    if (block.has_children) {
      const children = await listAllChildren(block.id);
      for (const child of children) {
        if ("type" in child && child.type === "bulleted_list_item") {
          notes.push(richTextToPlain(child.bulleted_list_item.rich_text));
        }
      }
    }

    highlights.push({ quote, notes });
  }

  return { highlights, mentalMap };
}
