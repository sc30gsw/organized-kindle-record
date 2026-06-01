import { chunk, delay } from 'es-toolkit';
import { NOTION_RICH_TEXT_MAX_LEN } from '~/lib/notion-limits';
import { Highlight } from '~/types';

export function chunkText(text: Highlight['text'], maxLen = NOTION_RICH_TEXT_MAX_LEN) {
  if (!text) return [''];
  const parts = chunk([...text], maxLen).map((chars) => chars.join(''));
  return parts.length > 0 ? parts : [''];
}

export { delay };
