import * as v from "valibot";
import type { Edge, Node } from "@xyflow/react";

/**
 * ノードが持つデータ。label / collapsed / color は永続化するが、
 * autoEdit と hiddenDescendants は実行時だけの一時フィールドで保存前に除去する。
 */
export type MindMapNodeData = {
  /** 永続化しない: 作成直後の空ノードを編集モードで開くための一時フラグ */
  autoEdit?: boolean;
  collapsed?: boolean;
  color?: string;
  /** 永続化しない: 折りたたみ中の「+N」チップ用に毎レンダー導出する値 */
  hiddenDescendants?: number;
  label: string;
};

export type MindMapNode = Node<MindMapNodeData>;
export type MindMapEdge = Edge;

/**
 * 所有フィールドだけを宣言し、それ以外（measured / selected / dragging / hidden など
 * react-flow が実行時に付ける値）は読み書きの両方で落とす。
 *
 * 当初は looseObject で通過させる方針だったが、その出力型は `[key: string]: unknown` を
 * 含み、TanStack Start の server fn シリアライズ制約（ValidateSerializable）に
 * `unknown` が通らないため採用できなかった。落とす対象はいずれも毎レンダー再計算される
 * 一時状態なので、復元結果は変わらない（むしろ古い selected / hidden が残らなくなる）。
 */
const mindMapNodeSchema = v.object({
  id: v.string(),
  // 'title' | 'text' の picklist にはしていない。既存 mind_map 行の実値を
  // 確認できる環境でのみ絞り込むべきで、外すと既存グラフが読めなくなる。
  type: v.optional(v.string()),
  position: v.object({ x: v.number(), y: v.number() }),
  // autoEdit / hiddenDescendants は永続化対象外。ここで宣言しないことが除去も兼ねる
  data: v.object({
    // label 無しを空文字とみなすのは描画側の既存挙動と同じ。境界へ寄せた
    label: v.fallback(v.string(), ""),
    collapsed: v.optional(v.boolean()),
    color: v.optional(v.string()),
  }),
});

const mindMapEdgeSchema = v.object({
  id: v.string(),
  source: v.string(),
  target: v.string(),
  // どのハンドルに繋いだかは描画結果を左右するので保持する（上下ハンドルは id なし = null）
  sourceHandle: v.nullish(v.string()),
  targetHandle: v.nullish(v.string()),
});

/** react-flow toObject() の保存形。 */
export const mindMapGraphSchema = v.object({
  nodes: v.array(mindMapNodeSchema),
  edges: v.array(mindMapEdgeSchema),
  viewport: v.optional(v.object({ x: v.number(), y: v.number(), zoom: v.number() })),
});

export type MindMapGraph = v.InferOutput<typeof mindMapGraphSchema>;

/** collection 行（getMindMapFn の戻り = drizzle 行）。 */
export const mindMapRowSchema = v.object({
  bookId: v.string(),
  graph: mindMapGraphSchema,
  updatedAt: v.number(),
});
