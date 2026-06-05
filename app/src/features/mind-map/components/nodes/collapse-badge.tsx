import { useReactFlow } from "@xyflow/react";
import { Badge } from "@mantine/core";

type CollapseBadgeProps = {
  count: number;
  id: string;
};

/** Miro 風: 折りたたみ中ノードの下端中央に隠れている子孫数を示すチップ。クリックで展開する。 */
export function CollapseBadge({ count, id }: CollapseBadgeProps) {
  const { updateNodeData } = useReactFlow();

  return (
    <Badge
      aria-label={`${count}件の子ノードを展開`}
      className="nodrag"
      color="blue"
      component="button"
      onClick={() => updateNodeData(id, { collapsed: false })}
      size="sm"
      style={{
        position: "absolute",
        bottom: -10,
        left: "50%",
        transform: "translateX(-50%)",
        cursor: "pointer",
      }}
      variant="filled"
    >
      +{count}
    </Badge>
  );
}
