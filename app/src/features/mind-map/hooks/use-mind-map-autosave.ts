import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import { mindMapCollection } from "@/features/mind-map/collections";
import { toPersistableGraph } from "@/features/mind-map/lib/persistable-graph";
import type { MindMapEdge, MindMapNode } from "@/features/mind-map/schemas/mind-map-schema";

const AUTOSAVE_DEBOUNCE_MS = 600;

type UseMindMapAutosaveArgs = {
  bookId: string;
  edges: MindMapEdge[];
  /** 既に mind_map 行があるか。無ければ初回保存で insert する。 */
  hasSavedGraph: boolean;
  nodes: MindMapNode[];
  rfRef: RefObject<ReactFlowInstance<MindMapNode, MindMapEdge> | null>;
};

/**
 * ノード/エッジ変更のたびにデバウンス保存する（最後の操作から AUTOSAVE_DEBOUNCE_MS 後に確定）。
 *
 * 保存対象はレンダー時の nodes/edges ではなく rfRef から読んだ最新の toObject() 出力。
 * nodes/edges は「変更があった」ことを検知するためだけに依存配列へ入れている。
 * こうすることで effect の依存を網羅したまま、レンダー中に ref へ代入せずに済む。
 */
export function useMindMapAutosave({
  bookId,
  edges,
  hasSavedGraph,
  nodes,
  rfRef,
}: UseMindMapAutosaveArgs) {
  const existsRef = useRef(hasSavedGraph);

  useEffect(() => {
    const timer = setTimeout(() => {
      const rf = rfRef.current;

      if (!rf) {
        return;
      }

      const graph = toPersistableGraph(rf.toObject());
      const updatedAt = Date.now();

      if (existsRef.current) {
        mindMapCollection.update(bookId, (draft) => {
          draft.graph = graph;
          draft.updatedAt = updatedAt;
        });
        return;
      }

      existsRef.current = true;
      mindMapCollection.insert({ bookId, userId: "", graph, updatedAt });
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [bookId, edges, nodes, rfRef]);
}
