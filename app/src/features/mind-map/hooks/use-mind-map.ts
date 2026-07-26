import { useRef } from "react";
import {
  addEdge,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type OnConnect,
  type OnNodeDrag,
  type ReactFlowInstance,
} from "@xyflow/react";
import { useMindMapAutosave } from "@/features/mind-map/hooks/use-mind-map-autosave";
import { computeCollapseState } from "@/features/mind-map/lib/collapse-state";
import {
  createPosition,
  newNodeId,
  nextCascade,
  titleNode,
  INITIAL_CASCADE,
} from "@/features/mind-map/lib/create-node";
import type {
  MindMapEdge,
  MindMapGraph,
  MindMapNode,
} from "@/features/mind-map/schemas/mind-map-schema";

type UseMindMapArgs = {
  bookId: string;
  bookTitle: string;
  initialGraph: MindMapGraph | null;
};

/** react-flow のローカル state を束ねる。保存は useMindMapAutosave、折りたたみ導出は collapse-state が持つ。 */
export function useMindMap({ bookId, bookTitle, initialGraph }: UseMindMapArgs) {
  const [nodes, setNodes, onNodesChange] = useNodesState<MindMapNode>(
    initialGraph?.nodes ?? [titleNode(bookTitle)],
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<MindMapEdge>(initialGraph?.edges ?? []);

  const rfRef = useRef<ReactFlowInstance<MindMapNode, MindMapEdge> | null>(null);
  const cascadeRef = useRef(INITIAL_CASCADE);
  // ドラッグ開始時に掴んだノードの位置。停止時に delta を出して隠れ領域へ反映する
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  useMindMapAutosave({ bookId, edges, hasSavedGraph: initialGraph !== null, nodes, rfRef });

  function onConnect(...args: Parameters<OnConnect>) {
    setEdges((eds) => addEdge(args[0], eds));
  }

  // 既存エッジの端をドラッグして別ノードへ繋ぎ替える
  function onReconnect(oldEdge: MindMapEdge, newConnection: Connection) {
    setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));
  }

  function addNode(label = "", type: "text" | "title" = "text") {
    // 常に「いま見えている画面の上部（追加ボタン付近）」に生成する。
    // パン/ズームが変わっていなければ小カスケードでずらし、動いたら段数をリセット
    const viewport = rfRef.current?.getViewport() ?? { x: 0, y: 0, zoom: 1 };
    cascadeRef.current = nextCascade(cascadeRef.current, viewport);

    setNodes((nds) => [
      ...nds.map((n) => (n.selected ? { ...n, selected: false } : n)),
      {
        id: newNodeId(),
        type,
        position: createPosition(viewport, cascadeRef.current),
        selected: true,
        // 空ノードは作成直後に編集モードで開く（ノート付けの導線短縮）。引用入りはそのまま表示
        data: label === "" ? { label, autoEdit: true } : { label },
      },
    ]);
  }

  function setRfInstance(rf: ReactFlowInstance<MindMapNode, MindMapEdge>) {
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
  function onNodeDragStart(...args: Parameters<OnNodeDrag<MindMapNode>>) {
    const node = args[1];
    dragStartRef.current = { x: node.position.x, y: node.position.y };
  }

  // 折りたたみノードをドラッグして停止したら、その隠れ領域を同じ delta で追従させる。
  // 隠れノードは描画されないため停止時に一括反映で十分。dragged ノード自身は react-flow が確定済み。
  function onNodeDragStop(...args: Parameters<OnNodeDrag<MindMapNode>>) {
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
