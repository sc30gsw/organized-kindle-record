import * as v from "valibot";
import { env as notionEnv } from "~/lib/env";

/**
 * 空文字を弾く必須文字列。`?? ""` を書ける余地を残さないため、
 * process.env の読み出しは app 全体でこのモジュールだけに閉じる。
 */
const requiredString = v.pipe(v.string(), v.trim(), v.minLength(1));

/**
 * better-auth が暗黙に読む値（BETTER_AUTH_SECRET / BETTER_AUTH_URL）も明示的に含める。
 * 欠けたまま起動して「誰もログインできないが原因不明」になるのを防ぐ。
 */
const appEnvSchema = v.object({
  ALLOWED_NOTION_EMAIL: requiredString,
  BETTER_AUTH_API_KEY: requiredString,
  BETTER_AUTH_SECRET: requiredString,
  BETTER_AUTH_URL: requiredString,
  NOTION_CLIENT_ID: requiredString,
  NOTION_CLIENT_SECRET: requiredString,
  TURSO_AUTH_TOKEN: requiredString,
  TURSO_DATABASE_URL: requiredString,
});

// `~/lib/env` の import が dotenv 読み込みを済ませているため、ここでは process.env を見るだけでよい
const parsed = v.safeParse(appEnvSchema, process.env);

if (!parsed.success) {
  const keys = [...new Set(parsed.issues.map((issue) => v.getDotPath(issue) ?? "(unknown)"))];

  throw new Error(`環境変数が未設定または空です: ${keys.join(", ")}`);
}

/** アプリ起動時に検証済みの env（Notion 系 10 キーを含む全量）。 */
export const env = Object.freeze({ ...parsed.output, ...notionEnv });
