import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import dotenv from "dotenv";

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env") });

const url = process.env["TURSO_DATABASE_URL"];
const authToken = process.env["TURSO_AUTH_TOKEN"];

if (!url || !authToken) {
  throw new Error("TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is not set");
}

/** better-auth(kysely) と同一 Turso を共有。mind_map など独自テーブルは Drizzle 経由で読み書きする。 */
export const db = drizzle(createClient({ url, authToken }));
