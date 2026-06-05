import { Button, Group, SegmentedControl } from "@mantine/core";
import { IconCopy, IconDownload } from "@tabler/icons-react";
import { useExportImage } from "@/features/mind-map/hooks/use-export-image";
import type { WheelMode } from "@/features/mind-map/schemas/wheel-mode-schema";

type MindMapToolbarProps = {
  exportFileName: string;
  onAddNode: () => void;
  onWheelModeChange: (mode: WheelMode) => void;
  wheelMode: WheelMode;
};

export function MindMapToolbar({
  exportFileName,
  onAddNode,
  onWheelModeChange,
  wheelMode,
}: MindMapToolbarProps) {
  const { exporting, downloadPng, copyPng } = useExportImage();

  return (
    <Group p="xs" gap="xs" justify="space-between">
      <Button size="xs" variant="light" onClick={onAddNode}>
        ＋ノード
      </Button>
      <Group gap="xs">
        <Button
          leftSection={<IconDownload size={14} />}
          loading={exporting}
          onClick={() => downloadPng(exportFileName)}
          size="xs"
          variant="light"
        >
          PNG保存
        </Button>
        <Button
          leftSection={<IconCopy size={14} />}
          loading={exporting}
          onClick={copyPng}
          size="xs"
          variant="light"
        >
          コピー
        </Button>
        <SegmentedControl
          size="xs"
          value={wheelMode}
          onChange={(value) => onWheelModeChange(value as WheelMode)}
          data={[
            { label: "スクロール", value: "pan" },
            { label: "ズーム", value: "zoom" },
          ]}
        />
      </Group>
    </Group>
  );
}
