import * as v from 'valibot';
import { READING_STATUS_OPTIONS } from '~/types/constants';

/** 読了ステータスの選択肢（core の SSoT を再利用）。 */
const statusNames = READING_STATUS_OPTIONS.map((o) => o.name) as [string, ...string[]];

export const defaultSearchParams = {
  q: '',
  status: undefined,
};

/** 検索フォーム兼 URL search params の単一スキーマ。 */
export const searchSchema = v.object({
  q: v.optional(v.string(), ''),
  status: v.optional(v.picklist(statusNames)),
});

export const STATUS_OPTIONS = statusNames;

export type BooksSearch = v.InferOutput<typeof searchSchema>;
export type BooksSearchInput = v.InferInput<typeof searchSchema>;
