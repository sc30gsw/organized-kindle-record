import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env") });

export default defineConfig({
  schema: ["./src/lib/db/schema.ts", "./src/lib/db/auth-schema.ts"],
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env["TURSO_DATABASE_URL"] ?? "",
    authToken: process.env["TURSO_AUTH_TOKEN"] ?? "",
  },
});
