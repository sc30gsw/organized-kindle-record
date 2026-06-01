import { useState } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { ActionIcon, Box, Group, Text, Textarea } from "@mantine/core";
import { IconPencil, IconTrash } from "@tabler/icons-react";

export function TextNode({ id, data }: NodeProps) {
  const { updateNodeData, deleteElements } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const label = typeof data["label"] === "string" ? data["label"] : "";

  return (
    <Box
      p="sm"
      bg="white"
      style={{ border: "1px solid var(--mantine-color-gray-4)", borderRadius: 8, minWidth: 140 }}
      onDoubleClick={() => setEditing(true)}
    >
      <Handle type="target" position={Position.Top} />
      {!editing && (
        <Group className="nodrag" gap={4} justify="flex-end" mb={4}>
          <ActionIcon
            aria-label="編集"
            color="gray"
            onClick={() => setEditing(true)}
            size="xs"
            variant="subtle"
          >
            <IconPencil size={14} />
          </ActionIcon>
          <ActionIcon
            aria-label="削除"
            color="red"
            onClick={() => deleteElements({ nodes: [{ id }] })}
            size="xs"
            variant="subtle"
          >
            <IconTrash size={14} />
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
        <Text size="sm">{label || "ダブルクリックで編集"}</Text>
      )}
      <Handle type="source" position={Position.Bottom} />
    </Box>
  );
}
