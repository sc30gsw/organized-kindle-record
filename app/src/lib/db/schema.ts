import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** JSON 直列化可能な値。TanStack Start の serializable 検査を通すため unknown を避ける。 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

/** react-flow の toObject() 出力（保存用）。nodes/edges は描画時に Node[]/Edge[] へ寄せる。 */
export type MindMapGraph = {
  nodes: JsonValue[];
  edges: JsonValue[];
  viewport?: Record<"x" | "y" | "zoom", number>;
};

/** 本ごとの読書ノート（マインドマップ）。1 冊 = 1 行。better-auth の kysely テーブルとは別管理。 */
export const mindMap = sqliteTable("mind_map", {
  bookId: text("book_id").primaryKey(),
  userId: text("user_id").notNull(),
  graph: text("graph", { mode: "json" }).$type<MindMapGraph>().notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type MindMapRow = typeof mindMap.$inferSelect;
