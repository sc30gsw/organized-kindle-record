import type { parseMd } from '~/parse-md';
import type { importBook, buildQuoteBlock } from '~/import-book';
import type { findOrCreateDatabase } from '~/create-database';

/** parseMd の戻り値が Book の SSoT。 */
export type Book = ReturnType<typeof parseMd>;
export type Highlight = Book['highlights'][number];

export type FailedEntry = {
  file: Book['filePath'];
  error: string;
};

export type DatabaseId = Awaited<ReturnType<typeof findOrCreateDatabase>>;
export type PageId = Awaited<ReturnType<typeof importBook>>;

export type ParseMdParams = Parameters<typeof parseMd>;
export type ImportBookParams = Parameters<typeof importBook>;
export type BuildQuoteBlockParams = Parameters<typeof buildQuoteBlock>;
export type AppendHighlightsParams = [pageId: PageId, newHighlights: Book['highlights']];

export type ParseMdFilePath = ParseMdParams[0];
export type ImportBookBook = ImportBookParams[0];

export {
  HIGHLIGHTS_SECTION_TITLE,
  READING_STATUS_DONE,
  READING_STATUS_OPTIONS,
} from '~/types/constants';
