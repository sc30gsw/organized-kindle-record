import { Button, Group, SegmentedControl } from "@mantine/core";
import type { WheelMode } from "@/features/mind-map/schemas/wheel-mode-schema";

type MindMapToolbarProps = {
  onAddNode: () => void;
  onWheelModeChange: (mode: WheelMode) => void;
  wheelMode: WheelMode;
};

export function MindMapToolbar({ onAddNode, onWheelModeChange, wheelMode }: MindMapToolbarProps) {
  return (
    <Group p="xs" gap="xs" justify="space-between">
      <Button size="xs" variant="light" onClick={onAddNode}>
        ＋ノード
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
  );
}
