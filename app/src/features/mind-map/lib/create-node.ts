import type { MindMapNode, MindMapNodeData } from "@/features/mind-map/schemas/mind-map-schema";

/** 新規ノードの生成アンカー（キャンバス左上基準の画面 px。ツールバー直下の見える位置）。 */
const CREATE_ANCHOR_PX = { x: 96, y: 72 };

/** 連続追加時のカスケードずらし幅（画面 px）。 */
const CASCADE_STEP_PX = 24;

type Viewport = Record<"x" | "y" | "zoom", number>;

/** 連続追加の段数。viewport が動いたらリセットする。 */
export type CascadeState = {
  count: number;
  viewportKey: string;
};

export const INITIAL_CASCADE: CascadeState = { count: 0, viewportKey: "" };

/** viewport が前回と同じなら段数を 1 つ進め、動いていたら 0 に戻す。 */
export function nextCascade(current: CascadeState, viewport: Viewport): CascadeState {
  const viewportKey = `${viewport.x}:${viewport.y}:${viewport.zoom}`;

  return current.viewportKey === viewportKey
    ? { count: current.count + 1, viewportKey }
    : { count: 0, viewportKey };
}

/**
 * 「いま見えている画面の上部（追加ボタン付近）」に相当するキャンバス座標を、
 * カスケード段数ぶんずらして返す。ズーム倍率で割ってキャンバス座標系へ変換している。
 */
export function createPosition(viewport: Viewport, cascade: CascadeState) {
  const offset = (cascade.count * CASCADE_STEP_PX) / viewport.zoom;

  return {
    x: (CREATE_ANCHOR_PX.x - viewport.x) / viewport.zoom + offset,
    y: (CREATE_ANCHOR_PX.y - viewport.y) / viewport.zoom + offset,
  };
}

/** 本のタイトルを表すルートノード。グラフが空のときの初期ノードになる。 */
export function titleNode(label: MindMapNodeData["label"]): MindMapNode {
  return { id: "title", type: "title", position: { x: 0, y: 0 }, data: { label } };
}

/** ノード id。同一ミリ秒での連続追加でも衝突しないよう乱数を混ぜる。 */
export function newNodeId() {
  return `n_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
}
