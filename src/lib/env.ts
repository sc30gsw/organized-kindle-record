import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';

/**
 * cwd から上へ辿って最初に見つかった .env を読む。
 * repo root（CLI）と app/（vite dev/build）のどちらから起動しても同じファイルに解決するため、
 * 相対パスを直書きしない。.env 不在（Vercel 等、process.env が既に埋まっている環境）は正常系。
 *
 * dotenv.config の呼び出しはリポジトリ全体でここだけ。app 側は `@/lib/env` 経由でこれを読む。
 */
function loadDotenv() {
  let dir = process.cwd();

  for (;;) {
    const candidate = resolve(dir, '.env');

    if (existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return;
    }

    const parent = dirname(dir);

    if (parent === dir) {
      return;
    }

    dir = parent;
  }
}

loadDotenv();

/**
 * env 事故は「未設定」ではなく「空文字が通る」形で起きる。
 * `?? ''` を書ける余地を残さないため、process.env の読み出しはこのモジュールに閉じる。
 */
function requireEnv(key: string) {
  const value = (process.env[key] ?? '').trim();

  if (value === '') {
    throw new Error(`環境変数 ${key} が未設定または空です（.env を確認してください）`);
  }

  return value;
}

/** CLI / importer が使う Notion 系 env。import 時点で fail-fast する。 */
export const env = Object.freeze({
  NOTION_TARGET_PAGE_ID: requireEnv('NOTION_TARGET_PAGE_ID'),
  NOTION_TOKEN: requireEnv('NOTION_TOKEN'),
});
