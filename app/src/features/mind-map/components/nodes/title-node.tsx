import { useState } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { ActionIcon, Box, Group, Text, Textarea } from "@mantine/core";
import { IconPencil } from "@tabler/icons-react";

export function TitleNode({ id, data }: NodeProps) {
  const { updateNodeData } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const label = typeof data["label"] === "string" ? data["label"] : "";

  return (
    <Box
      p="sm"
      bg="blue.6"
      c="white"
      style={{ borderRadius: 8, minWidth: 160 }}
      onDoubleClick={() => setEditing(true)}
    >
      <Handle type="target" position={Position.Top} />
      {!editing && (
        <Group className="nodrag" gap={4} justify="flex-end" mb={4}>
          <ActionIcon
            aria-label="編集"
            color="white"
            onClick={() => setEditing(true)}
            size="xs"
            variant="subtle"
          >
            <IconPencil size={14} />
          </ActionIcon>
        </Group>
      )}
      {editing ? (
        <Textarea
          className="nodrag"
          autosize
          minRows={1}
          autoFocus
          defaultValue={label}
          onBlur={(e) => {
            updateNodeData(id, { label: e.currentTarget.value });
            setEditing(false);
          }}
        />
      ) : (
        <Text fw={700}>{label || "タイトル"}</Text>
      )}
      <Handle type="source" position={Position.Bottom} />
    </Box>
  );
}
