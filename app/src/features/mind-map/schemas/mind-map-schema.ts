import * as v from "valibot";
import type { JsonValue } from "@/lib/db/schema";

const viewportSchema = v.object({ x: v.number(), y: v.number(), zoom: v.number() });

const jsonValueSchema: v.GenericSchema<JsonValue> = v.lazy(() =>
  v.union([
    v.string(),
    v.number(),
    v.boolean(),
    v.null(),
    v.array(jsonValueSchema),
    v.record(v.string(), jsonValueSchema),
  ]),
);

/** react-flow toObject() の保存形。nodes/edges は描画時に Node[]/Edge[] へ寄せる。 */
export const mindMapGraphSchema = v.object({
  nodes: v.array(jsonValueSchema),
  edges: v.array(jsonValueSchema),
  viewport: v.optional(viewportSchema),
});

/** collection 行（getMindMapFn の戻り = drizzle 行）。 */
export const mindMapRowSchema = v.object({
  bookId: v.string(),
  userId: v.string(),
  graph: mindMapGraphSchema,
  updatedAt: v.number(),
});

export type MindMapRowValues = v.InferOutput<typeof mindMapRowSchema>;
