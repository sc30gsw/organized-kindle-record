import * as v from "valibot";
import { READING_STATUS_OPTIONS } from "~/types/constants";

/** 読了ステータス名（core の SSoT から導出）。検索スキーマとバッジ配色もこれを使う。 */
export const READING_STATUS_NAMES = READING_STATUS_OPTIONS.map((option) => option.name);

export type ReadingStatus = (typeof READING_STATUS_NAMES)[number];

/** TanStack DB collection の行スキーマ。core の BookRow と一致させる。 */
export const bookRowSchema = v.object({
  id: v.string(),
  pageUrl: v.string(),
  coverUrl: v.nullable(v.string()),
  title: v.string(),
  authors: v.array(v.string()),
  // 未知の値は listBooksFn が toReadingStatus() で null に正規化してから返す
  status: v.nullable(v.picklist(READING_STATUS_NAMES)),
  amazonUrl: v.nullable(v.string()),
  kindleLink: v.nullable(v.string()),
  highlightCount: v.number(),
  lastUpdated: v.nullable(v.string()),
});

export type BookRowValues = v.InferOutput<typeof bookRowSchema>;

/**
 * Notion の「読了ステータス」を既知の選択肢へ正規化する。
 * Notion 側で選択肢が増やされていても collection の読み込みが落ちないよう、
 * 未知の値は「ステータス無し」に倒す（表示は非表示、絞り込みは対象外になる）。
 */
export function toReadingStatus(value: string | null) {
  return READING_STATUS_NAMES.find((name) => name === value) ?? null;
}
