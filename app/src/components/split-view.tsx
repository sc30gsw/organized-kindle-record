import type { ReactNode } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

/** react-resizable-panels v4 による左右リサイズ分割。詳細ページのハイライト/マインドマップに使う。 */
export function SplitView({ left, right }: Record<"left" | "right", ReactNode>) {
  return (
    <Group orientation="horizontal" style={{ height: "100%" }}>
      <Panel defaultSize={38} minSize={20}>
        {left}
      </Panel>
      <Separator
        style={{ width: 6, cursor: "col-resize", background: "var(--mantine-color-gray-3)" }}
      />
      <Panel minSize={30}>{right}</Panel>
    </Group>
  );
}
