import { useRef, useState } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { Box, Text, Textarea } from "@mantine/core";
import { NodeActions, nodeColorStyle } from "@/features/mind-map/components/nodes/node-actions";

export function TextNode({ id, data }: NodeProps) {
  const { updateNodeData } = useReactFlow();
  const boxRef = useRef<HTMLDivElement>(null);
  // autoEdit: 作成直後の空ノードは dblclick なしで即編集モードに入る
  const [editing, setEditing] = useState(Boolean(data["autoEdit"]));
  // 編集モード突入直前の実寸。Textarea 切替でノードサイズが跳ねるのを防ぐ
  const [editSize, setEditSize] = useState<{ height: number; width: number } | null>(null);
  const label = typeof data["label"] === "string" ? data["label"] : "";
  const color = typeof data["color"] === "string" ? data["color"] : "#ffffff";
  const { textColor, border } = nodeColorStyle(color);

  function startEditing() {
    const el = boxRef.current;
    setEditSize(el ? { height: el.offsetHeight, width: el.offsetWidth } : null);
    setEditing(true);
  }

  return (
    <Box
      ref={boxRef}
      p="sm"
      bg={color}
      c={textColor}
      style={{
        border,
        borderRadius: 8,
        minWidth: 140,
        // 編集中は元の幅を固定・高さは下限維持（autosize での伸びは許容）
        ...(editing && editSize ? { width: editSize.width, minHeight: editSize.height } : {}),
      }}
      onDoubleClick={startEditing}
    >
      <Handle type="target" position={Position.Top} />
      {!editing && <NodeActions color={color} id={id} onEdit={startEditing} />}
      {editing ? (
        <Textarea
          className="nodrag"
          autosize
          minRows={1}
          autoFocus
          defaultValue={label}
          placeholder="テキストを入力"
          onBlur={(e) => {
            updateNodeData(id, { label: e.currentTarget.value, autoEdit: false });
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
