import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import { authMiddleware } from "@/lib/auth-middleware";
import { PasteParseError } from "@/features/books/errors";
import { pastedContentSchema } from "@/features/books/schemas/paste-import-schema";
import { parseWebHighlights } from "~/parse-web-highlights";

/**
 * ペーストされた Web Highlights の書き出しを parse して preview 用に返す。
 *
 * Notion へは一切触らない。取込先候補は client 側の booksCollection から作れるので、
 * preview 表示のための Notion 往復は 0 回。
 * Result はシリアライズ境界を越えないよう plain object へ変換して返す。
 */
export const parsePastedFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(pastedContentSchema)
  .handler(({ data }) => {
    const parsed = Result.try({
      try: () => parseWebHighlights(data.content),
      catch: (cause) =>
        new PasteParseError({
          cause,
          message: cause instanceof Error ? cause.message : String(cause),
        }),
    });

    if (Result.isError(parsed)) {
      return { ok: false as const, message: parsed.error.message };
    }

    const { book, format, unsupportedBlockCount, rawTags } = parsed.value;

    if (book.highlights.length === 0) {
      return {
        ok: false as const,
        message:
          "ハイライトを 1 件も検出できませんでした。Web Highlights の Copy Markdown か HTML エクスポートを貼り付けてください。",
      };
    }

    return { ok: true as const, book, format, unsupportedBlockCount, rawTags };
  });

export type ParsePastedResult = Awaited<ReturnType<typeof parsePastedFn>>;
/** preview が扱う成功時のペイロード（ok: false を除いた形）。 */
export type PastedPreview = Extract<ParsePastedResult, Record<"ok", true>>;
