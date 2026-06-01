import { isFullPage } from '@notionhq/client';
import { notion, withRetry } from '~/notion-client';
import { READING_STATUS_OPTIONS } from '~/types/constants';
import type { DatabaseId } from '~/types';

export type DataSourceId = string;

type KindleDbProperties = {
  タイトル: { title: Record<string, never> };
  著者: { multi_select: Record<string, never> };
  ASIN: { rich_text: Record<string, never> };
  'Amazon URL': { url: Record<string, never> };
  'Kindle Link': { url: Record<string, never> };
  最終更新日: { date: Record<string, never> };
  ハイライト件数: { number: { format: 'number' } };
  読了ステータス: {
    select: {
      options: { name: string; color: string }[];
    };
  };
  タグ: { multi_select: Record<string, never> };
  'Cover URL': { url: Record<string, never> };
};

/** v5 databases.create の body（SDK named export を import しない）。 */
export type CreateKindleDatabaseParams = {
  parent: { type: 'page_id'; page_id: string };
  title: { type: 'text'; text: { content: string } }[];
  initial_data_source: { properties: KindleDbProperties };
};

export type QueryDataSourcePagesResponse = Awaited<ReturnType<typeof notion.dataSources.query>>;
export type DataSourceQueryResult = QueryDataSourcePagesResponse['results'][number];

/** Kindle DB のスキーマ（v5: databases.create の initial_data_source.properties）。 */
export const KINDLE_DB_PROPERTIES = {
  タイトル: { title: {} },
  著者: { multi_select: {} },
  ASIN: { rich_text: {} },
  'Amazon URL': { url: {} },
  'Kindle Link': { url: {} },
  最終更新日: { date: {} },
  ハイライト件数: { number: { format: 'number' } },
  読了ステータス: {
    select: {
      options: READING_STATUS_OPTIONS.map(({ name, color }) => ({ name, color })),
    },
  },
  タグ: { multi_select: {} },
  'Cover URL': { url: {} },
} satisfies KindleDbProperties;

export async function getPrimaryDataSourceId(databaseId: DatabaseId) {
  const db = await withRetry(() => notion.databases.retrieve({ database_id: databaseId }));
  if (!('data_sources' in db) || db.data_sources.length === 0) {
    throw new Error(`DB ${databaseId} に data source がありません`);
  }
  return db.data_sources[0]!.id;
}

export async function queryDataSourcePages(
  dataSourceId: DataSourceId,
  options: {
    filterProperties?: string[];
    startCursor?: string;
    pageSize?: number;
  } = {},
): Promise<QueryDataSourcePagesResponse> {
  return withRetry<QueryDataSourcePagesResponse>(() =>
    notion.dataSources.query({
      data_source_id: dataSourceId,
      ...(options.filterProperties ? { filter_properties: options.filterProperties } : {}),
      ...(options.startCursor ? { start_cursor: options.startCursor } : {}),
      page_size: options.pageSize ?? 100,
    }),
  );
}

export function pageFromQueryResult(result: DataSourceQueryResult) {
  return isFullPage(result) ? result : null;
}

export async function createKindleDatabase(params: CreateKindleDatabaseParams) {
  type NotionCreateDatabaseParams = Parameters<typeof notion.databases.create>[0];
  return withRetry(() => notion.databases.create(params as unknown as NotionCreateDatabaseParams));
}
