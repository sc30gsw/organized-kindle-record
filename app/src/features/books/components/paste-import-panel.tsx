import { useState, useTransition } from "react";
import { Result } from "better-result";
import { Button, Group, Stack, Stepper, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { booksCollection } from "@/features/books/collections";
import { ImportResultPanel } from "@/features/books/components/import-result-panel";
import { PastePreviewStep } from "@/features/books/components/paste-preview-step";
import { ImportRequestError } from "@/features/books/errors";
import { importPastedBookFn } from "@/features/books/server/import-pasted-book-fn";
import { parsePastedFn } from "@/features/books/server/parse-pasted-fn";
import type { PastedPreview } from "@/features/books/server/parse-pasted-fn";
import type { PasteOverrides, PasteTarget } from "@/features/books/schemas/paste-import-schema";
import type { ImportFileResult } from "@/features/books/types/import-result";
import type { UseDisclosureReturnValue } from "@mantine/hooks";

const RESULT_MESSAGE = {
  created: "新規ページを作成しました",
  updated: "ハイライトを追記しました",
  unchanged: "新しいハイライトはありませんでした",
  skipped: "取り込みをスキップしました",
  failed: "取り込みに失敗しました",
} as const satisfies Record<ImportFileResult["kind"], string>;

function messageOf(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * ペースト取込（貼り付け → 確認 → 取込）。
 *
 * Web Highlights の書き出しは ASIN を持たないので取込先を自動判定できない。
 * 2 段構えにして、既存ページへの追記か新規作成かをユーザーに確定させる。
 */
export function PasteImportPanel({
  onClose,
}: Record<"onClose", UseDisclosureReturnValue[1]["close"]>) {
  const [isParsing, startParsing] = useTransition();
  const [isImporting, startImporting] = useTransition();
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState<PastedPreview | null>(null);
  const [results, setResults] = useState<ImportFileResult[]>([]);

  const handleParse = () => {
    startParsing(async () => {
      setResults([]);

      const outcome = await Result.tryPromise({
        try: () => parsePastedFn({ data: { content } }),
        catch: (cause) => new ImportRequestError({ cause, message: messageOf(cause) }),
      });

      if (Result.isError(outcome)) {
        notifications.show({ title: "解析エラー", message: outcome.error.message, color: "red" });
        return;
      }

      if (!outcome.value.ok) {
        notifications.show({
          title: "解析できませんでした",
          message: outcome.value.message,
          color: "orange",
        });
        return;
      }

      setPreview(outcome.value);
    });
  };

  const handleImport = (input: { overrides: PasteOverrides; target: PasteTarget }) => {
    startImporting(async () => {
      const outcome = await Result.tryPromise({
        try: async () => {
          const res = await importPastedBookFn({ data: { content, ...input } });
          await booksCollection.utils.refetch();
          return res.result;
        },
        catch: (cause) => new ImportRequestError({ cause, message: messageOf(cause) }),
      });

      if (Result.isError(outcome)) {
        notifications.show({ title: "取込エラー", message: outcome.error.message, color: "red" });
        return;
      }

      const result = outcome.value;

      setResults([result]);

      // 成功したら次の 1 冊を貼れるよう入力をリセットする
      if (result.kind !== "failed") {
        setPreview(null);
        setContent("");
      }

      notifications.show({
        title: result.file,
        message: RESULT_MESSAGE[result.kind],
        color: result.kind === "failed" ? "red" : "green",
      });
    });
  };

  return (
    <Stack>
      <Stepper active={preview === null ? 0 : 1} allowNextStepsSelect={false}>
        <Stepper.Step label="貼り付け" description="Copy Markdown / HTML">
          <Stack mt="md">
            <Textarea
              label="Web Highlights の書き出しを貼り付け"
              description="Copy Markdown と HTML エクスポートのどちらでも、書式は自動判定します"
              placeholder={"# 書名\n\n**Highlights & Notes**\n\n> ハイライト"}
              value={content}
              onChange={(e) => setContent(e.currentTarget.value)}
              styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)" } }}
              autosize
              minRows={8}
              maxRows={16}
              disabled={isParsing}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={onClose} disabled={isParsing}>
                閉じる
              </Button>
              <Button
                onClick={handleParse}
                loading={isParsing}
                disabled={content.trim().length === 0}
              >
                内容を確認
              </Button>
            </Group>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="確認" description="取込先と項目を確定">
          {preview === null ? null : (
            <Stack mt="md">
              <PastePreviewStep
                preview={preview}
                isPending={isImporting}
                onBack={() => setPreview(null)}
                onSubmit={handleImport}
              />
            </Stack>
          )}
        </Stepper.Step>
      </Stepper>

      <ImportResultPanel results={results} />
    </Stack>
  );
}
