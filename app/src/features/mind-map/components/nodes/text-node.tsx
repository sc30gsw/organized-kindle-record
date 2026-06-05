import { useRef, useState } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { Box, Text, Textarea } from "@mantine/core";
import { CollapseBadge } from "@/features/mind-map/components/nodes/collapse-badge";
import { NodeActions, nodeColorStyle } from "@/features/mind-map/components/nodes/node-actions";
import { NodeHandles } from "@/features/mind-map/components/nodes/node-handles";

export function TextNode({ id, data }: NodeProps) {
  const { updateNodeData } = useReactFlow();
  const boxRef = useRef<HTMLDivElement>(null);
  // autoEdit: 作成直後の空ノードは dblclick なしで即編集モードに入る
  const [editing, setEditing] = useState(Boolean(data["autoEdit"]));
  // 編集モード突入直前の実寸。Textarea 切替でノードサイズが跳ねるのを防ぐ
  const [editSize, setEditSize] = useState<{ height: number; width: number } | null>(null);
  const label = typeof data["label"] === "string" ? data["label"] : "";
  const color = typeof data["color"] === "string" ? data["color"] : "#ffffff";
  const collapsed = data["collapsed"] === true;
  const hiddenDescendants =
    typeof data["hiddenDescendants"] === "number" ? data["hiddenDescendants"] : 0;
  const { textColor, border } = nodeColorStyle(color);

  function startEditing() {
    const el = boxRef.current;
    setEditSize(el ? { height: el.offsetHeight, width: el.offsetWidth } : null);
    setEditing(true);
  }

  // 保存して編集終了（⌘+Enter / ノード外クリック共通）
  function commit(value: string) {
    updateNodeData(id, { label: value, autoEdit: false });
    setEditing(false);
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
      <NodeHandles />
      {collapsed && hiddenDescendants > 0 && <CollapseBadge count={hiddenDescendants} id={id} />}
      {!editing && (
        <NodeActions collapsed={collapsed} color={color} id={id} onEdit={startEditing} />
      )}
      {editing ? (
        <Textarea
          className="nodrag"
          autosize
          minRows={1}
          autoFocus
          defaultValue={label}
          placeholder="テキストを入力"
          onKeyDown={(e) => {
            // ⌘+Enter で確定。Enter 単押しは改行のまま
            if (e.key === "Enter" && e.metaKey) {
              commit(e.currentTarget.value);
            }
          }}
          onBlur={(e) => commit(e.currentTarget.value)}
        />
      ) : (
        <Text size="sm" c={label ? undefined : "dimmed"} style={{ whiteSpace: "pre-wrap" }}>
          {label || "テキストを入力"}
        </Text>
      )}
    </Box>
  );
}
