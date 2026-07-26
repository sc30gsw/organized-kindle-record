import { describe, expect, test } from "vite-plus/test";
import { selectedTextWithin } from "@/features/books/lib/selected-text";

const FALLBACK = "引用の全文";

type Selection = Parameters<typeof selectedTextWithin>[0];
type Container = Parameters<typeof selectedTextWithin>[1];

const anchorNode = { nodeName: "#text" } as unknown as Node;

function selection(text: string, options: { collapsed?: boolean } = {}): Selection {
  return {
    anchorNode,
    isCollapsed: options.collapsed ?? false,
    toString: () => text,
  };
}

function container(containsAnchor: boolean): Container {
  return { contains: () => containsAnchor };
}

describe("selectedTextWithin", () => {
  test("選択が無ければ fallback", () => {
    expect(selectedTextWithin(null, container(true), FALLBACK)).toBe(FALLBACK);
  });

  test("選択が畳まれている（キャレットだけ）なら fallback", () => {
    expect(
      selectedTextWithin(selection("なにか", { collapsed: true }), container(true), FALLBACK),
    ).toBe(FALLBACK);
  });

  test("container が無ければ fallback", () => {
    expect(selectedTextWithin(selection("選択部分"), null, FALLBACK)).toBe(FALLBACK);
  });

  test("空白だけの選択は fallback", () => {
    expect(selectedTextWithin(selection("   \n  "), container(true), FALLBACK)).toBe(FALLBACK);
  });

  test("container の外を選択していれば fallback", () => {
    expect(selectedTextWithin(selection("よその文字"), container(false), FALLBACK)).toBe(FALLBACK);
  });

  test("container 内の選択はその文字列を返す（前後の空白は落とす）", () => {
    expect(selectedTextWithin(selection("  選択した一節  "), container(true), FALLBACK)).toBe(
      "選択した一節",
    );
  });
});
