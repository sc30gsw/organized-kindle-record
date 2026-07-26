import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "@/lib/env";

/** better-auth(kysely) と同一 Turso を共有。mind_map など独自テーブルは Drizzle 経由で読み書きする。 */
export const db = drizzle(
  createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN }),
);
