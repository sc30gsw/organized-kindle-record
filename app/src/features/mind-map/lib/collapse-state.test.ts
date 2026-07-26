import { describe, expect, test } from "vite-plus/test";
import { computeCollapseState } from "@/features/mind-map/lib/collapse-state";

type TestNode = Parameters<typeof computeCollapseState>[0][number];

function node(id: string, options: { collapsed?: boolean; title?: boolean } = {}): TestNode {
  return {
    id,
    ...(options.title === true ? { type: "title" } : {}),
    data: options.collapsed === true ? { collapsed: true } : {},
  };
}

function edge(source: string, target: string) {
  return { source, target };
}

describe("computeCollapseState", () => {
  test("空グラフでは何も隠れない", () => {
    const state = computeCollapseState([], []);

    expect([...state.hiddenNodeIds]).toEqual([]);
    expect([...state.hiddenDescendantCounts]).toEqual([]);
  });

  test("折りたたみが無ければ全ノードが可視のまま", () => {
    const state = computeCollapseState(
      [node("title", { title: true }), node("a"), node("b")],
      [edge("title", "a"), edge("a", "b")],
    );

    expect([...state.hiddenNodeIds]).toEqual([]);
  });

  test("折りたたみノード自身は可視で、その先だけ隠れる", () => {
    const state = computeCollapseState(
      [node("title", { title: true }), node("a", { collapsed: true }), node("b")],
      [edge("title", "a"), edge("a", "b")],
    );

    expect([...state.hiddenNodeIds]).toEqual(["b"]);
    expect(state.hiddenDescendantCounts.get("a")).toBe(1);
    expect([...(state.hiddenRegionByCollapsedId.get("a") ?? [])]).toEqual(["b"]);
  });

  test("エッジの向きは見ず、ルートに近い側を親として扱う", () => {
    // b -> a の向きで張られていても、タイトルから遠い b が隠れる
    const state = computeCollapseState(
      [node("title", { title: true }), node("a", { collapsed: true }), node("b")],
      [edge("title", "a"), edge("b", "a")],
    );

    expect([...state.hiddenNodeIds]).toEqual(["b"]);
  });

  test("タイトルノードがアンカーになる（配列の先頭ではなく type で決まる）", () => {
    // 配列順では leaf が先。title を優先アンカーにできていれば leaf 側が隠れる
    const state = computeCollapseState(
      [node("leaf"), node("mid", { collapsed: true }), node("title", { title: true })],
      [edge("title", "mid"), edge("mid", "leaf")],
    );

    expect([...state.hiddenNodeIds]).toEqual(["leaf"]);
  });

  test("タイトルと繋がっていない島は、その島で最初のノードがアンカーになる", () => {
    const state = computeCollapseState(
      [
        node("title", { title: true }),
        node("a"),
        // タイトルから独立した島。island1 が最初に現れるのでアンカーになる
        node("island1", { collapsed: true }),
        node("island2"),
      ],
      [edge("title", "a"), edge("island1", "island2")],
    );

    expect([...state.hiddenNodeIds]).toEqual(["island2"]);
    expect(state.hiddenDescendantCounts.get("island1")).toBe(1);
  });

  test("ネストした折りたたみは外側の +N に内側の子孫も含む", () => {
    const state = computeCollapseState(
      [
        node("title", { title: true }),
        node("a", { collapsed: true }),
        node("b", { collapsed: true }),
        node("c"),
        node("d"),
      ],
      [edge("title", "a"), edge("a", "b"), edge("b", "c"), edge("c", "d")],
    );

    // a 配下は b / c / d の 3 つ
    expect(state.hiddenDescendantCounts.get("a")).toBe(3);
    expect(state.hiddenNodeIds).toEqual(new Set(["b", "c", "d"]));
  });

  test("内側だけ折りたたむと外側は可視のまま内側の先が隠れる", () => {
    const state = computeCollapseState(
      [node("title", { title: true }), node("a"), node("b", { collapsed: true }), node("c")],
      [edge("title", "a"), edge("a", "b"), edge("b", "c")],
    );

    expect([...state.hiddenNodeIds]).toEqual(["c"]);
    expect(state.hiddenDescendantCounts.get("b")).toBe(1);
  });

  test("兄弟が複数ぶら下がる折りたたみは全員ぶんを数える", () => {
    const state = computeCollapseState(
      [
        node("title", { title: true }),
        node("a", { collapsed: true }),
        node("x"),
        node("y"),
        node("z"),
      ],
      [edge("title", "a"), edge("a", "x"), edge("a", "y"), edge("y", "z")],
    );

    expect(state.hiddenDescendantCounts.get("a")).toBe(3);
    expect(state.hiddenNodeIds).toEqual(new Set(["x", "y", "z"]));
  });

  test("孤立ノード（エッジ無し）は隠れない", () => {
    const state = computeCollapseState([node("title", { title: true }), node("lonely")], []);

    expect([...state.hiddenNodeIds]).toEqual([]);
  });
});
