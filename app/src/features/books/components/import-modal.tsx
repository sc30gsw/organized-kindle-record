import { useState, useTransition } from 'react';
import { Result } from 'better-result';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import { booksCollection } from '@/features/books/collections';
import { importBooksFn } from '@/features/books/server/import-books-fn';
import { ImportResultPanel } from '@/features/books/components/import-result-panel';
import { ImportRequestError } from '@/features/books/errors';
import type { ImportFileResult } from '@/features/books/server/import-books-fn';
import type { UseDisclosureReturnValue } from '@mantine/hooks';

type ImportModalProps = {
  opened: UseDisclosureReturnValue[0];
  onClose: UseDisclosureReturnValue[1]['close'];
};

export function ImportModal({ opened, onClose }: ImportModalProps) {
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<ImportFileResult[]>([]);

  const handleDrop = (files: File[]) => {
    startTransition(async () => {
      setResults([]);

      const outcome = await Result.tryPromise({
        try: async () => {
          const payload = await Promise.all(
            files.map(async (f) => ({ name: f.name, content: await f.text() })),
          );
          const res = await importBooksFn({ data: { files: payload } });
          await booksCollection.utils.refetch();
          return res.results;
        },
        catch: (cause) =>
          new ImportRequestError({
            cause,
            message: cause instanceof Error ? cause.message : String(cause),
          }),
      });

      if (Result.isError(outcome)) {
        notifications.show({ title: '取込エラー', message: outcome.error.message, color: 'red' });
        return;
      }

      setResults(outcome.value);
      const failed = outcome.value.filter((r) => r.kind === 'failed').length;
      notifications.show({
        title: '取込完了',
        message: `${outcome.value.length} 件処理（失敗 ${failed}）`,
        color: failed > 0 ? 'orange' : 'green',
      });
    });
  };

  return (
    <Modal opened={opened} onClose={onClose} title="md ファイルを取込" size="lg">
      <Stack>
        <Dropzone
          onDrop={handleDrop}
          loading={isPending}
          accept={{ 'text/markdown': ['.md', '.markdown'], 'text/plain': ['.md', '.markdown'] }}
          multiple
        >
          <Group justify="center" mih={140} style={{ pointerEvents: 'none' }}>
            <Text>ここに .md をドロップ、またはクリックで選択</Text>
          </Group>
        </Dropzone>
        <ImportResultPanel results={results} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            閉じる
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
