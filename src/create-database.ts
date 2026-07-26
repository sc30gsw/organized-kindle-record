import { notion, TARGET_PAGE_ID, DB_TITLE, withRetry } from '~/notion-client';
import { createKindleDatabase, KINDLE_DB_PROPERTIES } from '~/lib/notion-data-source';

async function resolveDatabaseId() {
  const children = await withRetry(() =>
    notion.blocks.children.list({ block_id: TARGET_PAGE_ID, page_size: 50 }),
  );

  for (const block of children.results) {
    if (
      'type' in block &&
      block.type === 'child_database' &&
      'child_database' in block &&
      block.child_database.title === DB_TITLE
    ) {
      return block.id;
    }
  }

  // 新規作成
  console.log(`DB「${DB_TITLE}」を作成中...`);
  const createParams = {
    parent: { type: 'page_id', page_id: TARGET_PAGE_ID },
    title: [{ type: 'text', text: { content: DB_TITLE } }],
    initial_data_source: {
      properties: KINDLE_DB_PROPERTIES,
    },
  } satisfies Parameters<typeof createKindleDatabase>[0];

  const db = await createKindleDatabase(createParams);

  console.log(`DB 作成完了: ${db.id}`);
  return db.id;
}

/** プロセス内キャッシュ。解決前に複数呼ばれても Notion 往復は 1 回に集約される。 */
let databaseIdPromise: Promise<string> | null = null;

/**
 * 「この Notion アカウントの Kindle DB は 1 つ」はドメイン事実なので解決結果を保持する。
 * サーバー経路では listBooksFn / importBooksFn 1 回ごとに blocks.children.list を
 * 叩いていたのが、プロセス初回だけになる。
 *
 * プロセス生存期間のキャッシュなので、Notion 側で DB を作り直した場合は
 * サーバー再起動まで古い ID を掴む（単一ユーザーの内部ツールとして許容する）。
 */
export function findOrCreateDatabase() {
  databaseIdPromise ??= resolveDatabaseId().catch((err: unknown) => {
    // 失敗はキャッシュしない（一時的な 5xx で以後ずっと落ち続けるのを避ける）
    databaseIdPromise = null;
    throw err;
  });

  return databaseIdPromise;
}

// standalone 実行: npx tsx src/create-database.ts
if (process.argv[1]?.endsWith('create-database.ts')) {
  const id = await findOrCreateDatabase();
  console.log(`\nDB ID: ${id}`);
}
