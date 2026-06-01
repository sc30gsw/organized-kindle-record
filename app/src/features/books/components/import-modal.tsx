import { useState } from 'react';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import { booksCollection } from '@/features/books/collections';
import { importBooksFn } from '@/features/books/server/import-books-fn';
import { ImportResultPanel } from '@/features/books/components/import-result-panel';
import type { ImportFileResult } from '@/features/books/types';

export function ImportModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ImportFileResult[]>([]);

  const handleDrop = async (files: File[]) => {
    setLoading(true);
    setResults([]);
    try {
      const payload = await Promise.all(
        files.map(async (f) => ({ name: f.name, content: await f.text() })),
      );
      const res = await importBooksFn({ data: { files: payload } });
      setResults(res.results);
      await booksCollection.utils.refetch();
      const failed = res.results.filter((r) => r.kind === 'failed').length;
      notifications.show({
        title: '取込完了',
        message: `${res.results.length} 件処理（失敗 ${failed}）`,
        color: failed > 0 ? 'orange' : 'green',
      });
    } catch (e) {
      notifications.show({
        title: '取込エラー',
        message: e instanceof Error ? e.message : String(e),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="md ファイルを取込" size="lg">
      <Stack>
        <Dropzone
          onDrop={handleDrop}
          loading={loading}
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
