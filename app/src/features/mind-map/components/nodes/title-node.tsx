import { useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { Box, Text, Textarea, useMantineTheme } from "@mantine/core";
import { NodeActions, nodeColorStyle } from "@/features/mind-map/components/nodes/node-actions";
import { NodeHandles } from "@/features/mind-map/components/nodes/node-handles";

export function TitleNode({ id, data }: NodeProps) {
  const { updateNodeData } = useReactFlow();
  const theme = useMantineTheme();
  const [editing, setEditing] = useState(false);
  const label = typeof data["label"] === "string" ? data["label"] : "";
  const color = typeof data["color"] === "string" ? data["color"] : theme.colors.blue[6];
  const { textColor, border } = nodeColorStyle(color);

  // 保存して編集終了（⌘+Enter / ノード外クリック共通）
  function commit(value: string) {
    updateNodeData(id, { label: value });
    setEditing(false);
  }

  return (
    <Box
      p="sm"
      bg={color}
      c={textColor}
      style={{ border, borderRadius: 8, minWidth: 160 }}
      onDoubleClick={() => setEditing(true)}
    >
      <NodeHandles />
      {!editing && <NodeActions color={color} id={id} onEdit={() => setEditing(true)} />}
      {editing ? (
        <Textarea
          className="nodrag"
          autosize
          minRows={1}
          autoFocus
          defaultValue={label}
          onKeyDown={(e) => {
            // ⌘+Enter で確定。Enter 単押しは改行のまま
            if (e.key === "Enter" && e.metaKey) {
              commit(e.currentTarget.value);
            }
          }}
          onBlur={(e) => commit(e.currentTarget.value)}
        />
      ) : (
        <Text fw={700} style={{ whiteSpace: "pre-wrap" }}>
          {label || "タイトル"}
        </Text>
      )}
    </Box>
  );
}
