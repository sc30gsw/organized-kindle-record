import { useEffect, useRef } from "react";
import {
  addEdge,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  type OnNodeDrag,
  type ReactFlowInstance,
} from "@xyflow/react";
import { mindMapCollection } from "@/features/mind-map/collections";
import type { MindMapGraph } from "@/lib/db/schema";

const AUTOSAVE_DEBOUNCE_MS = 600;

/** 新規ノードの生成アンカー（キャンバス左上基準の画面 px。ツールバー直下の見える位置）。 */
const CREATE_ANCHOR_PX = { x: 96, y: 72 };

/** 連続追加時のカスケードずらし幅（画面 px）。 */
const CASCADE_STEP_PX = 24;

function titleNode(label: string): Node {
  return { id: "title", type: "title", position: { x: 0, y: 0 }, data: { label } };
}

/**
 * ルート基準の折りたたみ導出状態。エッジの向き（どちらからドラッグしたか）は見ず、
 * 無向グラフとして「ルートに近い側が親」で判定する。
 * - アンカー: タイトルノード。タイトルと繋がっていない島は、その島で最初に作られたノード
 * - hiddenNodeIds: アンカーから折りたたみノード（data.collapsed）を越えずに辿れないノード id
 * - hiddenDescendantCounts: 折りたたみノード id → そこに接する隠れ領域のノード数（Miro 風「+N」チップ用）
 */
function computeCollapseState(nodes: Node[], edges: Edge[]) {
  const neighborsOf = new Map<string, string[]>();
  for (const edge of edges) {
    neighborsOf.set(edge.source, [...(neighborsOf.get(edge.source) ?? []), edge.target]);
    neighborsOf.set(edge.target, [...(neighborsOf.get(edge.target) ?? []), edge.source]);
  }

  const collapsedIds = new Set(nodes.filter((n) => n.data["collapsed"] === true).map((n) => n.id));

  function bfs(startIds: string[], stopAtCollapsed: boolean, limitTo?: Set<string>): Set<string> {
    const seen = new Set<string>();
    const stack = [...startIds];
    let current = stack.pop();
    while (current !== undefined) {
      if (!seen.has(current) && (limitTo === undefined || limitTo.has(current))) {
        seen.add(current);
        // 折りたたみノード自身は可視のまま、その先だけ辿らない
        if (!(stopAtCollapsed && collapsedIds.has(current))) {
          stack.push(...(neighborsOf.get(current) ?? []));
        }
      }
      current = stack.pop();
    }
    return seen;
  }

  // タイトルノードを最優先アンカーに、未処理の連結成分ごとに可視集合を作る
  const orderedIds = [
    ...nodes.filter((n) => n.type === "title").map((n) => n.id),
    ...nodes.filter((n) => n.type !== "title").map((n) => n.id),
  ];
  const assigned = new Set<string>();
  const visible = new Set<string>();
  for (const anchorId of orderedIds) {
    if (assigned.has(anchorId)) {
      continue;
    }
    for (const member of bfs([anchorId], false)) {
      assigned.add(member);
    }
    for (const v of bfs([anchorId], true)) {
      visible.add(v);
    }
  }

  const hiddenNodeIds = new Set(nodes.map((n) => n.id).filter((id) => !visible.has(id)));

  // 各折りたたみノードの隠れ領域: 隣接する隠れノードから隠れ領域内だけを辿った id 集合。
  // ネストした折りたたみも stopAtCollapsed=false で全て含む。ドラッグ追従と +N チップの両方がこれを使う。
  const hiddenRegionByCollapsedId = new Map(
    [...collapsedIds].map((id) => {
      const hiddenNeighbors = (neighborsOf.get(id) ?? []).filter((nb) => hiddenNodeIds.has(nb));
      return [id, bfs(hiddenNeighbors, false, hiddenNodeIds)] as const;
    }),
  );

  // 「+N」チップ用の子孫数は隠れ領域のサイズから導出
  const hiddenDescendantCounts = new Map(
    [...hiddenRegionByCollapsedId].map(([id, region]) => [id, region.size] as const),
  );

  return { hiddenNodeIds, hiddenDescendantCounts, hiddenRegionByCollapsedId };
}

type UseMindMapArgs = {
  bookId: string;
  bookTitle: string;
  initialGraph: MindMapGraph | null;
};

/** react-flow のローカル state を保持し、変更をデバウンスして TanStack DB collection 経由で自動保存する。 */
export function useMindMap({ bookId, bookTitle, initialGraph }: UseMindMapArgs) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    (initialGraph?.nodes as unknown as Node[] | undefined) ?? [titleNode(bookTitle)],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    (initialGraph?.edges as unknown as Edge[] | undefined) ?? [],
  );

  const rfRef = useRef<ReactFlowInstance<Node, Edge> | null>(null);
  const existsRef = useRef(initialGraph !== null);
  const saveRef = useRef<() => void>(() => {});
  // 連続追加のカスケード段数。viewport が動いたらリセットする
  const cascadeRef = useRef({ count: 0, viewportKey: "" });
  // ドラッグ開始時に掴んだノードの位置。停止時に delta を出して隠れ領域へ反映する
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  saveRef.current = () => {
    const rf = rfRef.current;
    if (!rf) {
      return;
    }

    const raw = rf.toObject();
    // autoEdit（作成直後だけ編集モードで開く一時フラグ）と hiddenDescendants（毎レンダー導出の表示用カウント）は
    // 永続化対象外のため保存前に除去する
    const graph = {
      ...raw,
      nodes: raw.nodes.map((n) => {
        const { autoEdit: _autoEdit, hiddenDescendants: _hiddenDescendants, ...data } = n.data;
        return { ...n, data };
      }),
    } as unknown as MindMapGraph;

    if (existsRef.current) {
      mindMapCollection.update(bookId, (draft) => {
        draft.graph = graph;
        draft.updatedAt = Date.now();
      });
    } else {
      existsRef.current = true;
      mindMapCollection.insert({ bookId, userId: "", graph, updatedAt: Date.now() });
    }
  };

  // ノード/エッジ変更のたびにデバウンス保存（最後の操作から AUTOSAVE_DEBOUNCE_MS 後に確定）
  useEffect(() => {
    const t = setTimeout(() => saveRef.current(), AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [nodes, edges]);

  function onConnect(...args: Parameters<OnConnect>) {
    setEdges((eds) => addEdge(args[0], eds));
  }

  // 既存エッジの端をドラッグして別ノードへ繋ぎ替える
  function onReconnect(oldEdge: Edge, newConnection: Connection) {
    setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));
  }

  function addNode(label = "", type: "text" | "title" = "text") {
    const id = `n_${Date.now()}_${Math.round(Math.random() * 1e6)}`;

    // 常に「いま見えている画面の上部（追加ボタン付近）」に生成する。
    // パン/ズームが変わっていなければ小カスケードでずらし、動いたら段数をリセット
    const vp = rfRef.current?.getViewport() ?? { x: 0, y: 0, zoom: 1 };
    const viewportKey = `${vp.x}:${vp.y}:${vp.zoom}`;
    cascadeRef.current =
      cascadeRef.current.viewportKey === viewportKey
        ? { count: cascadeRef.current.count + 1, viewportKey }
        : { count: 0, viewportKey };
    const offset = (cascadeRef.current.count * CASCADE_STEP_PX) / vp.zoom;
    const position = {
      x: (CREATE_ANCHOR_PX.x - vp.x) / vp.zoom + offset,
      y: (CREATE_ANCHOR_PX.y - vp.y) / vp.zoom + offset,
    };

    setNodes((nds) => [
      ...nds.map((n) => (n.selected ? { ...n, selected: false } : n)),
      {
        id,
        type,
        position,
        selected: true,
        // 空ノードは作成直後に編集モードで開く（ノート付けの導線短縮）。引用入りはそのまま表示
        data: label === "" ? { label, autoEdit: true } : { label },
      },
    ]);
  }

  function setRfInstance(rf: ReactFlowInstance<Node, Edge>) {
    rfRef.current = rf;
  }

  // 折りたたみ状態から hidden と「+N」チップ用の子孫数を毎レンダー導出する（保存値には依存しない）
  const { hiddenNodeIds, hiddenDescendantCounts, hiddenRegionByCollapsedId } = computeCollapseState(
    nodes,
    edges,
  );
  const visibleNodes = nodes.map((n) => {
    const base = { ...n, hidden: hiddenNodeIds.has(n.id) };
    const count = hiddenDescendantCounts.get(n.id);
    return count === undefined
      ? base
      : { ...base, data: { ...base.data, hiddenDescendants: count } };
  });
  const visibleEdges = edges.map((e) => ({
    ...e,
    hidden: hiddenNodeIds.has(e.source) || hiddenNodeIds.has(e.target),
  }));

  // ドラッグ開始時、掴んだノードの位置を控える
  function onNodeDragStart(...args: Parameters<OnNodeDrag<Node>>) {
    const node = args[1];
    dragStartRef.current = { x: node.position.x, y: node.position.y };
  }

  // 折りたたみノードをドラッグして停止したら、その隠れ領域を同じ delta で追従させる。
  // 隠れノードは描画されないため停止時に一括反映で十分。dragged ノード自身は react-flow が確定済み。
  function onNodeDragStop(...args: Parameters<OnNodeDrag<Node>>) {
    const [, node, draggedNodes] = args;
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!start) {
      return;
    }
    const delta = { x: node.position.x - start.x, y: node.position.y - start.y };
    if (delta.x === 0 && delta.y === 0) {
      return;
    }

    // ドラッグ集合（掴んだノード＋複数選択分）に含まれる折りたたみノードの隠れ領域を union（重複排除）
    const draggedIds = new Set([node.id, ...draggedNodes.map((n) => n.id)]);
    const toShift = new Set<string>();
    for (const id of draggedIds) {
      for (const hiddenId of hiddenRegionByCollapsedId.get(id) ?? []) {
        toShift.add(hiddenId);
      }
    }
    if (toShift.size === 0) {
      return;
    }

    setNodes((nds) =>
      nds.map((n) =>
        toShift.has(n.id)
          ? { ...n, position: { x: n.position.x + delta.x, y: n.position.y + delta.y } }
          : n,
      ),
    );
  }

  return {
    nodes: visibleNodes,
    edges: visibleEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onReconnect,
    onNodeDragStart,
    onNodeDragStop,
    addNode,
    setRfInstance,
  };
}
