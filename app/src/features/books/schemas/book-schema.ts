import * as v from "valibot";

/** TanStack DB collection の行スキーマ。core の BookRow と一致させる。 */
export const bookRowSchema = v.object({
  id: v.string(),
  pageUrl: v.string(),
  coverUrl: v.nullable(v.string()),
  title: v.string(),
  authors: v.array(v.string()),
  status: v.nullable(v.string()),
  amazonUrl: v.nullable(v.string()),
  kindleLink: v.nullable(v.string()),
  highlightCount: v.number(),
  lastUpdated: v.nullable(v.string()),
});

export type BookRowValues = v.InferOutput<typeof bookRowSchema>;
