import * as v from "valibot";
import { READING_STATUS_NAMES } from "@/features/books/schemas/book-schema";

/** Notion の date プロパティは ISO 日付しか受け付けない。 */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const pastedContentSchema = v.object({
  content: v.pipe(v.string(), v.minLength(1, "貼り付ける内容がありません")),
});

/**
 * 取込先。Web Highlights の書き出しは ASIN を持たないので自動判定できず、
 * 「新規作成」か「どの既存ページへ追記するか」を必ず明示してもらう。
 */
const pasteTargetSchema = v.variant("kind", [
  v.object({ kind: v.literal("create") }),
  v.object({
    kind: v.literal("append"),
    pageId: v.pipe(v.string(), v.minLength(1, "取込先ページが未選択です")),
  }),
]);

/** preview で編集した項目。書き出しが落とした項目を復元できる唯一の地点。 */
const pasteOverridesSchema = v.object({
  title: v.pipe(v.string(), v.trim(), v.minLength(1, "タイトルは必須です")),
  authors: v.array(v.pipe(v.string(), v.trim(), v.minLength(1))),
  asin: v.nullable(v.pipe(v.string(), v.trim())),
  tags: v.array(v.pipe(v.string(), v.trim(), v.minLength(1))),
  lastUpdated: v.nullable(
    v.pipe(v.string(), v.regex(ISO_DATE_RE, "最終更新日は YYYY-MM-DD で指定してください")),
  ),
  status: v.nullable(v.picklist(READING_STATUS_NAMES)),
});

export const importPastedBookSchema = v.object({
  ...pastedContentSchema.entries,
  target: pasteTargetSchema,
  overrides: pasteOverridesSchema,
});

export type PasteTarget = v.InferOutput<typeof pasteTargetSchema>;
export type PasteOverrides = v.InferOutput<typeof pasteOverridesSchema>;

/** Select の「新規作成」を表す値。Notion の page id は UUID なので衝突しない。 */
export const CREATE_TARGET_VALUE = "__create__";

/**
 * preview フォームの入力値。
 * 未入力は空文字で持ち（Mantine の input が返す形）、送信時に null へ寄せる。
 */
export const pasteFormSchema = v.object({
  title: v.pipe(v.string(), v.trim(), v.minLength(1, "タイトルは必須です")),
  authors: v.array(v.string()),
  asin: v.union([
    v.literal(""),
    v.pipe(v.string(), v.trim(), v.regex(/^[A-Za-z0-9]{10}$/, "ASIN は英数字 10 桁です")),
  ]),
  tags: v.array(v.string()),
  lastUpdated: v.union([
    v.literal(""),
    v.pipe(v.string(), v.regex(ISO_DATE_RE, "最終更新日は YYYY-MM-DD で指定してください")),
  ]),
  status: v.union([v.literal(""), v.picklist(READING_STATUS_NAMES)]),
  targetPageId: v.pipe(v.string(), v.minLength(1, "取込先を選択してください")),
});

export type PasteFormInput = v.InferInput<typeof pasteFormSchema>;
