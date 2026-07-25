import type { MindMapGraph, MindMapNode } from "@/features/mind-map/schemas/mind-map-schema";

type ReactFlowObject = {
  edges: MindMapGraph["edges"];
  nodes: MindMapNode[];
  viewport: MindMapGraph["viewport"];
};

/**
 * react-flow の toObject() 出力から、永続化してはいけない一時フィールドを落とす。
 * - autoEdit: 作成直後だけ編集モードで開くためのフラグ
 * - hiddenDescendants: 折りたたみ状態から毎レンダー導出する表示用カウント
 * どちらも保存すると次回読み込み時に古い値が復活してしまう。
 */
export function toPersistableGraph(raw: ReactFlowObject): MindMapGraph {
  return {
    ...raw,
    nodes: raw.nodes.map((node) => {
      const { autoEdit: _autoEdit, hiddenDescendants: _hiddenDescendants, ...data } = node.data;

      return { ...node, data };
    }),
  };
}
