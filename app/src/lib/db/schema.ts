import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { MindMapGraph } from "@/features/mind-map/schemas/mind-map-schema";

/** 本ごとの読書ノート（マインドマップ）。1 冊 = 1 行。better-auth の kysely テーブルとは別管理。 */
// このアプリはシングルユーザー固定（ALLOWED_NOTION_EMAIL 1 件）なので user_id 列は持たない。
// 列があると「必ず userId で絞る」という守れない約束が生まれ、実際 getMindMapFn は絞れていなかった。
export const mindMap = sqliteTable("mind_map", {
  bookId: text("book_id").primaryKey(),
  // 保存形の SSoT は mind-map-schema.ts の valibot スキーマ（型のみ参照するので実行時依存はない）
  graph: text("graph", { mode: "json" }).$type<MindMapGraph>().notNull(),
  updatedAt: integer("updated_at").notNull(),
});
