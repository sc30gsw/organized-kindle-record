import { useState } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { Box, Text, Textarea, useMantineTheme } from "@mantine/core";
import { NodeActions, nodeColorStyle } from "@/features/mind-map/components/nodes/node-actions";

export function TitleNode({ id, data }: NodeProps) {
  const { updateNodeData } = useReactFlow();
  const theme = useMantineTheme();
  const [editing, setEditing] = useState(false);
  const label = typeof data["label"] === "string" ? data["label"] : "";
  const color = typeof data["color"] === "string" ? data["color"] : theme.colors.blue[6];
  const { textColor, border } = nodeColorStyle(color);

  return (
    <Box
      p="sm"
      bg={color}
      c={textColor}
      style={{ border, borderRadius: 8, minWidth: 160 }}
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
