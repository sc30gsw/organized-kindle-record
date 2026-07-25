import * as v from "valibot";
import { describe, expect, test } from "vite-plus/test";
import { toPersistableGraph } from "@/features/mind-map/lib/persistable-graph";
import { mindMapGraphSchema } from "@/features/mind-map/schemas/mind-map-schema";

/** react-flow が toObject() で返す形（実行時にだけ付くフィールドを含む）。 */
function reactFlowLikeGraph() {
  return {
    nodes: [
      {
        id: "title",
        type: "title",
        position: { x: 0, y: 0 },
        data: { label: "本のタイトル" },
        // 以下は react-flow が実行時に付ける値
        measured: { width: 160, height: 40 },
        selected: true,
        dragging: false,
      },
      {
        id: "n_1",
        type: "text",
        position: { x: 10, y: 20 },
        data: { label: "メモ", collapsed: true, color: "#ffcc00" },
      },
    ],
    edges: [
      { id: "e1", source: "title", target: "n_1", sourceHandle: "right", targetHandle: null },
    ],
    viewport: { x: 1, y: 2, zoom: 1.5 },
  };
}

describe("mindMapGraphSchema", () => {
  test("react-flow が付ける一時フィールドを落として所有フィールドだけ残す", () => {
    const parsed = v.parse(mindMapGraphSchema, reactFlowLikeGraph());

    expect(parsed.nodes[0]).toEqual({
      id: "title",
      type: "title",
      position: { x: 0, y: 0 },
      data: { label: "本のタイトル" },
    });
  });

  test("描画に効くフィールド（position / type / handle / color / collapsed）は保持する", () => {
    const parsed = v.parse(mindMapGraphSchema, reactFlowLikeGraph());

    expect(parsed.nodes[1]).toEqual({
      id: "n_1",
      type: "text",
      position: { x: 10, y: 20 },
      data: { label: "メモ", collapsed: true, color: "#ffcc00" },
    });
    expect(parsed.edges[0]).toEqual({
      id: "e1",
      source: "title",
      target: "n_1",
      sourceHandle: "right",
      targetHandle: null,
    });
    expect(parsed.viewport).toEqual({ x: 1, y: 2, zoom: 1.5 });
  });

  test("label 欠落は空文字にフォールバックして読み込みを壊さない", () => {
    const parsed = v.parse(mindMapGraphSchema, {
      nodes: [{ id: "a", position: { x: 0, y: 0 }, data: {} }],
      edges: [],
    });

    expect(parsed.nodes[0]?.data.label).toBe("");
  });

  test("id / position が壊れている行は受け付けない", () => {
    const broken = {
      nodes: [{ id: "a", position: { x: "0", y: 0 }, data: { label: "x" } }],
      edges: [],
    };

    expect(v.safeParse(mindMapGraphSchema, broken).success).toBe(false);
  });

  test("空のグラフを受け付ける", () => {
    const parsed = v.parse(mindMapGraphSchema, { nodes: [], edges: [] });

    expect(parsed).toEqual({ nodes: [], edges: [] });
  });
});

describe("toPersistableGraph", () => {
  test("autoEdit と hiddenDescendants を保存前に除去する", () => {
    const graph = toPersistableGraph({
      nodes: [
        {
          id: "a",
          type: "text",
          position: { x: 0, y: 0 },
          data: { label: "x", autoEdit: true, hiddenDescendants: 3, collapsed: true },
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });

    expect(graph.nodes[0]?.data).toEqual({ label: "x", collapsed: true });
  });

  test("除去後のグラフはそのままスキーマを通る", () => {
    const graph = toPersistableGraph({
      nodes: [
        { id: "a", type: "text", position: { x: 1, y: 2 }, data: { label: "x", autoEdit: true } },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });

    expect(v.safeParse(mindMapGraphSchema, graph).success).toBe(true);
  });
});
