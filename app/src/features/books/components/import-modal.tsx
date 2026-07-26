import { Modal, Tabs } from "@mantine/core";
import { FileImportPanel } from "@/features/books/components/file-import-panel";
import { PasteImportPanel } from "@/features/books/components/paste-import-panel";
import type { UseDisclosureReturnValue } from "@mantine/hooks";

type ImportModalProps = {
  opened: UseDisclosureReturnValue[0];
  onClose: UseDisclosureReturnValue[1]["close"];
};

/**
 * 取込モーダル。
 *
 * ペースト（Web Highlights）とファイル（Glasp の .md）は取込先の決め方が違うので
 * タブで分ける。keepMounted={false} により、タブを切り替えると入力と結果が捨てられる。
 */
export function ImportModal({ opened, onClose }: ImportModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="ハイライトを取込" size="xl">
      <Tabs defaultValue="paste" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="paste">ペースト</Tabs.Tab>
          <Tabs.Tab value="file">ファイル</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="paste" pt="md">
          <PasteImportPanel onClose={onClose} />
        </Tabs.Panel>
        <Tabs.Panel value="file" pt="md">
          <FileImportPanel onClose={onClose} />
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}
