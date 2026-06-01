import { useState } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { Box, Text, Textarea } from "@mantine/core";
import { NodeActions, nodeColorStyle } from "@/features/mind-map/components/nodes/node-actions";

export function TextNode({ id, data }: NodeProps) {
  const { updateNodeData } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const label = typeof data["label"] === "string" ? data["label"] : "";
  const color = typeof data["color"] === "string" ? data["color"] : "#ffffff";
  const { textColor, border } = nodeColorStyle(color);

  return (
    <Box
      p="sm"
      bg={color}
      c={textColor}
      style={{ border, borderRadius: 8, minWidth: 140 }}
      onDoubleClick={() => setEditing(true)}
    >
      <Handle type="target" position={Position.Top} />
      {!editing && <NodeActions color={color} id={id} onEdit={() => setEditing(true)} />}
      {editing ? (
        <Textarea
          className="nodrag"
          autosize
          minRows={1}
          autoFocus
          defaultValue={label}
          placeholder="テキストを入力"
          onBlur={(e) => {
            updateNodeData(id, { label: e.currentTarget.value });
            setEditing(false);
          }}
        />
      ) : (
        <Text size="sm" c={label ? undefined : "dimmed"}>
          {label || "テキストを入力"}
        </Text>
      )}
      <Handle type="source" position={Position.Bottom} />
    </Box>
  );
}
