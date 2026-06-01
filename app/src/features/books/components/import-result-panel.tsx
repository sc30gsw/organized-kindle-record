import { ImportFileResult } from "@/features/books/server/import-books-fn";
import { Alert, List, Stack, Text } from "@mantine/core";

const LABEL = {
  created: "作成",
  updated: "更新",
  unchanged: "変更なし",
  skipped: "スキップ",
  failed: "失敗",
} as const satisfies Record<ImportFileResult["kind"], string>;

export function ImportResultPanel({ results }: Record<"results", ImportFileResult[]>) {
  if (results.length === 0) {
    return null;
  }

  const created = results.filter((r) => r.kind === "created").length;
  const updated = results.filter((r) => r.kind === "updated").length;
  const failed = results.filter((r) => r.kind === "failed").length;

  return (
    <Stack gap="xs">
      <Text fw={600}>
        取込結果: 作成 {created} / 更新 {updated} / 失敗 {failed}
      </Text>
      <List size="sm" spacing={4}>
        {results.map((r) => (
          <List.Item key={r.file}>
            {LABEL[r.kind]} — {r.file}
            {(r.kind === "created" || r.kind === "updated") && ` (+${r.added})`}
            {r.kind === "skipped" && ` (${r.reason})`}
            {r.kind === "failed" && ` (${r.error})`}
          </List.Item>
        ))}
      </List>
      {failed > 0 && (
        <Alert color="red" title="一部失敗">
          失敗したファイルを確認してください。
        </Alert>
      )}
    </Stack>
  );
}
