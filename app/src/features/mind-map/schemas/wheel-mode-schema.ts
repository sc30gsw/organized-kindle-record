import * as v from "valibot";

export const WHEEL_MODES = ["pan", "zoom"] as const;

export type WheelMode = (typeof WHEEL_MODES)[number];

export const defaultBookDetailSearchParams = {
  wheel: "pan",
} as const satisfies { wheel: WheelMode };

/** 書籍詳細ページの URL search params。マインドマップのホイール挙動（pan=スクロール / zoom=ズーム）を保持する。 */
export const bookDetailSearchSchema = v.object({
  wheel: v.optional(v.picklist(WHEEL_MODES), defaultBookDetailSearchParams.wheel),
});

export type BookDetailSearch = v.InferOutput<typeof bookDetailSearchSchema>;
