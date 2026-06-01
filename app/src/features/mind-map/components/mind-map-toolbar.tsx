import { Button, Group } from "@mantine/core";

export function MindMapToolbar({ onAddNode }: Record<"onAddNode", () => void>) {
  return (
    <Group p="xs" gap="xs">
      <Button size="xs" variant="light" onClick={onAddNode}>
        ＋ノード
      </Button>
    </Group>
  );
}
