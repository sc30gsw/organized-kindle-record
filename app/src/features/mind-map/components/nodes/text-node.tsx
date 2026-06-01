import { useState } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { Box, Text, Textarea } from "@mantine/core";

export function TextNode({ id, data }: NodeProps) {
  const { updateNodeData } = useReactFlow();
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
