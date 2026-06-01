import { format, parse } from '@formkit/tempo';
import { Book } from '~/types';

const GLASP_LAST_UPDATED_RE = /- Last Updated on: .*?(\d{4})年(\d{1,2})月(\d{1,2})日/;

/** Glasp の「Last Updated on: …YYYY年M月D日」から ISO 日付 (YYYY-MM-DD) を返す。 */
export function parseGlaspLastUpdated(content: string) {
  const match = content.match(GLASP_LAST_UPDATED_RE);
  if (!match) return null;

  const [, y, m, d] = match;
  const date = parse(`${y}年${Number(m)}月${Number(d)}日`, 'YYYY年M月D日');
  return format(date, 'YYYY-MM-DD');
}

/** Book.lastUpdated (YYYY-MM-DD) をソート用タイムスタンプに変換。null は最古扱い。 */
export function lastUpdatedSortKey(isoDate: Book['lastUpdated']) {
  if (!isoDate) return Number.NEGATIVE_INFINITY;
  return parse(isoDate, 'YYYY-MM-DD').getTime();
}
