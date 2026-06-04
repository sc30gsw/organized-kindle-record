import type { ReactNode } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

/** react-resizable-panels v4 による左右リサイズ分割。詳細ページのハイライト/マインドマップに使う。 */
export function SplitView({ left, right }: Record<"left" | "right", ReactNode>) {
  return (
    <Group orientation="horizontal" className="h-full">
      {/* v4 は数値を px 解釈するため、割合はパーセント文字列で指定する */}
      <Panel defaultSize="38%" minSize="20%">
        {left}
      </Panel>
      <Separator className="w-1.5 cursor-col-resize bg-[var(--mantine-color-gray-3)]" />
      <Panel minSize="30%">{right}</Panel>
    </Group>
  );
}
