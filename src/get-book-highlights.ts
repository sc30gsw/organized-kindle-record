import { BlockObjectResponse } from "@notionhq/client";
import { notion, withRetry } from "~/notion-client";
import { Highlight, PageId } from "~/types";

/** 1 ハイライト分の表示用データ（引用 + メモ群）。Notion の quote ブロックと子 bullet から復元。 */
export type BookHighlight = {
  quote: string;
  notes: Highlight["notes"];
};

function richTextToPlain(richText: Record<"plain_text", string>[]) {
  return richText.map((rt) => rt.plain_text).join("");
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

/** Notion ページの quote ブロック（+ 子 bulleted_list_item メモ）を読書ハイライトとして復元する。 */
export async function getBookHighlights(pageId: PageId) {
  const topBlocks = await listAllChildren(pageId);
  const highlights: BookHighlight[] = [];

  for (const block of topBlocks) {
    if (!("type" in block) || block.type !== "quote") continue;

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

  return highlights;
}
