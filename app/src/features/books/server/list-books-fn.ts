import { createServerFn } from '@tanstack/react-start';

/** Notion DB の全ページを一覧行として返す（サーバー専用：handler 内は client に出ない）。 */
export const listBooksFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { listBooks } = await import('~/list-books');
  return listBooks();
});
