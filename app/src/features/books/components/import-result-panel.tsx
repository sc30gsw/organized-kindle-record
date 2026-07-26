import { Alert, List, Stack, Text } from "@mantine/core";
import type { ImportFileResult } from "@/features/books/types/import-result";

const LABEL = {
  created: "作成",
  updated: "更新",
  unchanged: "変更なし",
  skipped: "スキップ",
  failed: "失敗",
} as const satisfies Record<ImportFileResult["kind"], string>;

const EMPTY_COUNTS = {
  created: 0,
  updated: 0,
  unchanged: 0,
  skipped: 0,
  failed: 0,
} as const satisfies Record<ImportFileResult["kind"], number>;

export function ImportResultPanel({ results }: Record<"results", ImportFileResult[]>) {
  if (results.length === 0) {
    return null;
  }

  // 種別ごとの件数は 1 パスで数える（kind ごとに filter を並べると走査が増える）
  const counts = results.reduce<Record<ImportFileResult["kind"], number>>(
    (acc, r) => ({ ...acc, [r.kind]: acc[r.kind] + 1 }),
    EMPTY_COUNTS,
  );

  return (
    <Stack gap="xs">
      <Text fw={600}>
        取込結果: 作成 {counts.created} / 更新 {counts.updated} / 変更なし {counts.unchanged} /
        スキップ {counts.skipped} / 失敗 {counts.failed}
      </Text>
      <List size="sm" spacing={4}>
        {results.map((r) => (
          <List.Item key={r.id}>
            {LABEL[r.kind]}: {r.file}
            {(r.kind === "created" || r.kind === "updated") && ` (+${r.added})`}
            {r.kind === "skipped" && ` (${r.reason})`}
            {r.kind === "failed" && ` (${r.error})`}
          </List.Item>
        ))}
      </List>
      {counts.failed > 0 && (
        <Alert color="red" title="一部失敗">
          失敗した項目を確認してください。
        </Alert>
      )}
    </Stack>
  );
}
