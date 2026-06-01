import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
import { delay } from '~/lib/text';

dotenv.config();

const token = process.env['NOTION_TOKEN'];
const targetPageId = process.env['NOTION_TARGET_PAGE_ID'];

if (!token) throw new Error('NOTION_TOKEN が .env に設定されていません');
if (!targetPageId) throw new Error('NOTION_TARGET_PAGE_ID が .env に設定されていません');

export const notion: Client = new Client({ auth: token });
export const TARGET_PAGE_ID = targetPageId;
export const DB_TITLE = 'Kindle 読書記録';

export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isRateLimit =
        err instanceof Error && 'code' in err && (err as { code: string }).code === 'rate_limited';
      if (isRateLimit && attempt < maxAttempts) {
        const backoffMs = 1000 * 2 ** attempt;
        console.warn(
          `  429 rate limited — ${backoffMs}ms 待機後リトライ (${attempt}/${maxAttempts})`,
        );
        await delay(backoffMs);
        continue;
      }
      throw err;
    }
  }
  throw new Error('unreachable');
}
