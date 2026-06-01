/** parse-md / import-book で共有する見出し文字列。 */
export const HIGHLIGHTS_SECTION_TITLE = 'Highlights & Notes';

/** Notion DB の読了ステータス選択肢。 */
export const READING_STATUS_OPTIONS = [
  { name: '未読', color: 'gray' },
  { name: '読書中', color: 'blue' },
  { name: '読了', color: 'green' },
  { name: '再読', color: 'purple' },
] as const satisfies readonly Record<string, string>[];

export const READING_STATUS_DONE = '読了';
