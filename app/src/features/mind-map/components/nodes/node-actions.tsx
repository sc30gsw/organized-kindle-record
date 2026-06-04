import { useState } from "react";
import { useReactFlow } from "@xyflow/react";
import {
  ActionIcon,
  ColorPicker,
  Group,
  MantineColor,
  Popover,
  useMantineTheme,
} from "@mantine/core";
import { IconPalette, IconPencil, IconTrash } from "@tabler/icons-react";

const SWATCH_KEYS = [
  "blue",
  "teal",
  "green",
  "yellow",
  "orange",
  "red",
  "grape",
  "gray",
] as const satisfies readonly MantineColor[];

/** 背景色（hex）から読みやすい文字色と枠線を決める。明るい背景は黒字＋枠線、暗い背景は白字。 */
export function nodeColorStyle(color: MantineColor) {
  const hex = color.replace("#", "");
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const light = Number.isNaN(luminance) || luminance > 0.6;

  return {
    textColor: light ? "var(--mantine-color-black)" : "var(--mantine-color-white)",
    border: light ? "1px solid var(--mantine-color-gray-4)" : undefined,
  };
}

type NodeActionsProps = {
  color: MantineColor;
  id: string;
  onEdit: () => void;
};

/** ノード共通の操作ボタン群（編集 / 配色 / 削除）。ボタンのみ nodrag にしてノード自体はドラッグ可能なまま。 */
export function NodeActions({ color, id, onEdit }: NodeActionsProps) {
  const { updateNodeData, deleteElements } = useReactFlow();
  const theme = useMantineTheme();
  // ⌘+Enter で閉じられるよう controlled にする（外クリック閉じは onChange 経由で維持）
  const [pickerOpened, setPickerOpened] = useState(false);
  const swatches = ["#ffffff", ...SWATCH_KEYS.map((key) => theme.colors[key][6])];

  return (
    <Group gap={4} justify="flex-end" mb={4}>
      <ActionIcon
        aria-label="編集"
        className="nodrag"
        color="gray"
        onClick={onEdit}
        size="xs"
        variant="subtle"
      >
        <IconPencil size={14} />
      </ActionIcon>

      <Popover
        onChange={setPickerOpened}
        opened={pickerOpened}
        position="bottom"
        shadow="sm"
        withArrow
      >
        <Popover.Target>
          <ActionIcon
            aria-label="配色"
            className="nodrag"
            color="gray"
            onClick={() => setPickerOpened((opened) => !opened)}
            size="xs"
            variant="subtle"
          >
            <IconPalette size={14} />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown
          className="nodrag"
          onKeyDown={(e) => {
            // ⌘+Enter で配色ポップオーバーを閉じる（色自体は選択時に即反映済み）
            if (e.key === "Enter" && e.metaKey) {
              setPickerOpened(false);
            }
          }}
          p="xs"
        >
          <ColorPicker
            defaultValue={color}
            format="hex"
            onChangeEnd={(value) => updateNodeData(id, { color: value })}
            onColorSwatchClick={(value) => updateNodeData(id, { color: value })}
            size="sm"
            swatches={swatches}
            swatchesPerRow={9}
          />
        </Popover.Dropdown>
      </Popover>

      <ActionIcon
        aria-label="削除"
        className="nodrag"
        color="red"
        onClick={() => deleteElements({ nodes: [{ id }] })}
        size="xs"
        variant="subtle"
      >
        <IconTrash size={14} />
      </ActionIcon>
    </Group>
  );
}
