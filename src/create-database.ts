import { assertNotionEnv, notion, TARGET_PAGE_ID, DB_TITLE, withRetry } from '~/notion-client';
import { createKindleDatabase, KINDLE_DB_PROPERTIES } from '~/lib/notion-data-source';

export async function findOrCreateDatabase() {
  assertNotionEnv();

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
      console.log(`既存 DB を再利用: ${block.id}`);
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

// standalone 実行: npx tsx src/create-database.ts
if (process.argv[1]?.endsWith('create-database.ts')) {
  const id = await findOrCreateDatabase();
  console.log(`\nDB ID: ${id}`);
}
