import { findOrCreateDatabase } from '~/create-database';
import {
  getPrimaryDataSourceId,
  pageFromQueryResult,
  queryDataSourcePages,
} from '~/lib/notion-data-source';

/** 一覧表 1 行ぶんの本データ（Notion ページから写像）。collection schema 兼 列ソース。 */
export type BookRow = {
  id: string;
  pageUrl: string;
  coverUrl: string | null;
  title: string;
  authors: string[];
  status: string | null;
  amazonUrl: string | null;
  kindleLink: string | null;
  highlightCount: number;
  lastUpdated: string | null;
};

type FullPage = NonNullable<ReturnType<typeof pageFromQueryResult>>;

function titleText(page: FullPage) {
  const prop = page.properties['タイトル'];
  return prop?.type === 'title' ? prop.title.map((t) => t.plain_text).join('') : '';
}

function authorsOf(page: FullPage) {
  const prop = page.properties['著者'];
  return prop?.type === 'multi_select' ? prop.multi_select.map((o) => o.name) : [];
}

function statusOf(page: FullPage) {
  const prop = page.properties['読了ステータス'];
  return prop?.type === 'select' ? (prop.select?.name ?? null) : null;
}

function urlProp(page: FullPage, name: string) {
  const prop = page.properties[name];
  return prop?.type === 'url' ? (prop.url ?? null) : null;
}

function numberProp(page: FullPage, name: string) {
  const prop = page.properties[name];
  return prop?.type === 'number' ? (prop.number ?? 0) : 0;
}

function dateStart(page: FullPage, name: string) {
  const prop = page.properties[name];
  return prop?.type === 'date' ? (prop.date?.start ?? null) : null;
}

function coverUrlOf(page: FullPage) {
  const fromProp = urlProp(page, 'Cover URL');
  if (fromProp) return fromProp;
  const cover = page.cover;
  if (!cover) return null;
  if (cover.type === 'external') return cover.external.url;
  if (cover.type === 'file') return cover.file.url;
  return null;
}

function toBookRow(page: FullPage): BookRow {
  return {
    id: page.id,
    pageUrl: page.url,
    coverUrl: coverUrlOf(page),
    title: titleText(page),
    authors: authorsOf(page),
    status: statusOf(page),
    amazonUrl: urlProp(page, 'Amazon URL'),
    kindleLink: urlProp(page, 'Kindle Link'),
    highlightCount: numberProp(page, 'ハイライト件数'),
    lastUpdated: dateStart(page, '最終更新日'),
  };
}

/** Notion DB の全ページを取得し、一覧行へ写像する（ページング吸収）。 */
export async function listBooks(): Promise<BookRow[]> {
  const databaseId = await findOrCreateDatabase();
  const dataSourceId = await getPrimaryDataSourceId(databaseId);
  const rows: BookRow[] = [];
  let cursor: string | undefined;
  do {
    const res = await queryDataSourcePages(dataSourceId, { startCursor: cursor });
    for (const result of res.results) {
      const page = pageFromQueryResult(result);
      if (page) rows.push(toBookRow(page));
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return rows;
}
