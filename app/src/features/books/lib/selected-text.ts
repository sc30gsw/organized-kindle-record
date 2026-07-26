/** Selection のうちこの判定に必要な部分だけ（テストで素のオブジェクトを渡せるようにする）。 */
type SelectionLike = Pick<Selection, "anchorNode" | "isCollapsed" | "toString">;

/** contains だけ使うので Element 全体は要求しない。 */
type ContainerLike = Pick<Element, "contains">;

/**
 * container 内でテキスト選択中ならその文字列、なければ fallback（引用全文）を返す。
 * window へは触らず、呼び出し側が window.getSelection() の結果を渡す。
 */
export function selectedTextWithin(
  selection: SelectionLike | null,
  container: ContainerLike | null,
  fallback: string,
): string {
  if (!selection || selection.isCollapsed || !container) {
    return fallback;
  }

  const text = selection.toString().trim();

  if (text === "" || !container.contains(selection.anchorNode)) {
    return fallback;
  }

  return text;
}
