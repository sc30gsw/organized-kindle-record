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

  saveRef.current = () => {
    const rf = rfRef.current;
    if (!rf) {
      return;
    }

    const graph = rf.toObject() as unknown as MindMapGraph;

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
    setNodes((nds) => {
      // 直前のノードから少しずらして配置（重なって見えなくなるのを防ぐ）
      const last = nds.at(-1)?.position ?? { x: 0, y: 0 };
      const position = { x: last.x + 48, y: last.y + 64 };
      return [...nds, { id, type, position, data: { label } }];
    });
  }

  function setRfInstance(rf: ReactFlowInstance<Node, Edge>) {
    rfRef.current = rf;
  }

  return { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, setRfInstance };
}
