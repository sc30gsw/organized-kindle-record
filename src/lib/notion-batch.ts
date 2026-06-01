import { chunk } from 'es-toolkit';
import { NOTION_CHILDREN_BATCH_SIZE } from '~/lib/notion-limits';

export function chunkNotionChildren<T>(blocks: readonly T[]) {
  return chunk([...blocks], NOTION_CHILDREN_BATCH_SIZE);
}
