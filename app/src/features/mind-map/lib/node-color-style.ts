import type { MantineColor } from "@mantine/core";

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
