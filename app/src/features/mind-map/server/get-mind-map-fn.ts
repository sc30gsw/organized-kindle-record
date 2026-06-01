import { createServerFn } from "@tanstack/react-start";
import { ensureSession } from "@/lib/auth-functions";
import { db } from "@/lib/db";
import { mindMap } from "@/lib/db/schema";

/** 単一ユーザーの全マインドマップ行を返す（mindMapCollection の queryFn 用）。 */
export const getMindMapFn = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSession();
  return db.select().from(mindMap);
});
