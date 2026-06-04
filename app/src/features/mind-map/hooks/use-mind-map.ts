import { useEffect, useRef } from "react";
import {
  addEdge,
  useEdgesState,
  useNodesState,
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

  return { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, setRfInstance };
}
