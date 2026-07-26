import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth-middleware";
import { db } from "@/lib/db";
import { mindMap } from "@/lib/db/schema";

/** 単一ユーザーの全マインドマップ行を返す（mindMapCollection の queryFn 用）。 */
export const getMindMapFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => db.select().from(mindMap));
