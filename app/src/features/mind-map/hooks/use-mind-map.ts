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
 * source→target を親→子とみなし、折りたたみノード（data.collapsed）の下流ノード id を返す。
 * 循環は訪問済みガードで打ち切り。根（入次数0）から辿れない循環島は誤って隠さず可視のまま残す。
 */
function computeHiddenNodeIds(nodes: Node[], edges: Edge[]): Set<string> {
  const childrenOf = new Map<string, string[]>();
  const hasIncoming = new Set<string>();
  for (const edge of edges) {
    childrenOf.set(edge.source, [...(childrenOf.get(edge.source) ?? []), edge.target]);
    hasIncoming.add(edge.target);
  }

  const collapsedIds = new Set(nodes.filter((n) => n.data["collapsed"] === true).map((n) => n.id));
  const rootIds = nodes.filter((n) => !hasIncoming.has(n.id)).map((n) => n.id);

  function collectReachable(stopAtCollapsed: boolean): Set<string> {
    const seen = new Set<string>();
    const stack = [...rootIds];
    let current = stack.pop();
    while (current !== undefined) {
      if (!seen.has(current)) {
        seen.add(current);
        // 折りたたみノード自身は可視のまま、その先だけ辿らない
        if (!(stopAtCollapsed && collapsedIds.has(current))) {
          stack.push(...(childrenOf.get(current) ?? []));
        }
      }
      current = stack.pop();
    }
    return seen;
  }

  const visible = collectReachable(true);
  const reachable = collectReachable(false);

  return new Set([...reachable].filter((id) => !visible.has(id)));
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

  saveRef.current = () => {
    const rf = rfRef.current;
    if (!rf) {
      return;
    }

    const raw = rf.toObject();
    // autoEdit は「作成直後だけ編集モードで開く」一時フラグ。永続化するとリロード時に編集モードが復活するため保存前に除去する
    const graph = {
      ...raw,
      nodes: raw.nodes.map((n) => {
        const { autoEdit: _autoEdit, ...data } = n.data;
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

  // 折りたたみ状態から hidden を毎レンダー導出する（保存値には依存しない）
  const hiddenNodeIds = computeHiddenNodeIds(nodes, edges);
  const visibleNodes = nodes.map((n) => ({ ...n, hidden: hiddenNodeIds.has(n.id) }));
  const visibleEdges = edges.map((e) => ({
    ...e,
    hidden: hiddenNodeIds.has(e.source) || hiddenNodeIds.has(e.target),
  }));

  return {
    nodes: visibleNodes,
    edges: visibleEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onReconnect,
    addNode,
    setRfInstance,
  };
}
