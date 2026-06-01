import { BlockObjectResponse } from "@notionhq/client";
import { notion, withRetry } from "~/notion-client";
import { Highlight, PageId } from "~/types";

/** 1 ハイライト分の表示用データ（引用 + メモ群）。Notion の quote ブロックと子 bullet から復元。 */
export type BookHighlight = {
  quote: string;
  notes: Highlight["notes"];
};

/** メンタルマップの 1 問分。質問（H3 見出し）とその配下の答え群。 */
export type MentalMapItem = {
  question: string;
  answers: string[];
};

/** ページ詳細の取得結果。ハイライトと「メンタルマップ」(H2 セクション) の構造化データ。 */
export type BookDetail = {
  highlights: BookHighlight[];
  mentalMap: MentalMapItem[];
};

const MENTAL_MAP_HEADING = "メンタルマップ";

const SECTION_BOUNDARY_LABELS = new Set(["Summary", "Highlights & Notes"]);

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
 * 「メンタルマップ」H2 セクションを復元する。
 * メンタルマップは H3 見出し（「1. …」等の質問）ごとに、配下の本文を答えとしてまとめる。
 * 収集は次の H1/H2、または Summary / Highlights & Notes（H3）、quote で終了する。
 */
export async function getBookHighlights(pageId: PageId): Promise<BookDetail> {
  const topBlocks = await listAllChildren(pageId);
  const highlights: BookHighlight[] = [];
  const mentalMap: MentalMapItem[] = [];
  let inMentalMap = false;
  let currentItem: MentalMapItem | null = null;

  /** メンタルマップ収集中の本文を、現在の質問の答えとして追加する（質問が無ければ作る）。 */
  function pushAnswer(text: string) {
    if (!currentItem) {
      currentItem = { question: "", answers: [] };
      mentalMap.push(currentItem);
    }
    currentItem.answers.push(text);
  }

  for (const block of topBlocks) {
    if (!("type" in block)) {
      continue;
    }

    // H1/H2 はセクション境界。「メンタルマップ」H2 のときだけ収集を開始する。
    if (block.type === "heading_1" || block.type === "heading_2") {
      const headingText =
        block.type === "heading_2" ? richTextToPlain(block.heading_2.rich_text).trim() : "";
      inMentalMap = headingText === MENTAL_MAP_HEADING;
      currentItem = null;
      continue;
    }

    // H3：メンタルマップ内では質問見出し（新しい項目）。Summary/Highlights & Notes だけ境界。
    if (block.type === "heading_3") {
      const h3 = richTextToPlain(block.heading_3.rich_text).trim();
      if (inMentalMap && !SECTION_BOUNDARY_LABELS.has(h3)) {
        currentItem = { question: h3, answers: [] };
        mentalMap.push(currentItem);
      } else {
        inMentalMap = false;
        currentItem = null;
      }
      continue;
    }

    if (inMentalMap) {
      const text = blockText(block);
      const trimmed = text?.trim() ?? "";

      // quote（ハイライト開始）や平テキストの既知ラベルに当たったら収集を終了し、通常処理へ落とす。
      if (block.type === "quote" || SECTION_BOUNDARY_LABELS.has(trimmed)) {
        inMentalMap = false;
        currentItem = null;
      } else {
        if (text) {
          pushAnswer(text);
        }

        if (block.has_children) {
          const children = await listAllChildren(block.id);

          for (const child of children) {
            const childText = blockText(child);
            if (childText) {
              pushAnswer(childText);
            }
          }
        }
        continue;
      }
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
