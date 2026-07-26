import * as v from "valibot";
import { READING_STATUS_NAMES } from "@/features/books/schemas/book-schema";

export const defaultSearchParams = {
  q: "",
  status: undefined,
} as const satisfies { q: string; status: (typeof READING_STATUS_NAMES)[number] | undefined };

/** 検索フォーム兼 URL search params の単一スキーマ。 */
export const searchSchema = v.object({
  q: v.optional(v.string(), ""),
  status: v.optional(v.picklist(READING_STATUS_NAMES)),
});

export const STATUS_OPTIONS = READING_STATUS_NAMES;

export type BooksSearch = v.InferOutput<typeof searchSchema>;
export type BooksSearchInput = v.InferInput<typeof searchSchema>;
