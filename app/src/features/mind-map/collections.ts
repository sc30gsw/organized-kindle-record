import { createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { queryClient } from "@/lib/query-client";
import { mindMapRowSchema } from "@/features/mind-map/schemas/mind-map-schema";
import { getMindMapFn } from "@/features/mind-map/server/get-mind-map-fn";
import { saveMindMapFn } from "@/features/mind-map/server/save-mind-map-fn";

/** 本ごとの読書ノート。読み込みは collection、保存は onInsert/onUpdate から server fn 経由（楽観更新）。 */
export const mindMapCollection = createCollection(
  queryCollectionOptions({
    queryClient,
    queryKey: ["mindMaps"],
    queryFn: () => getMindMapFn(),
    getKey: (item) => item.bookId,
    schema: mindMapRowSchema,
    onInsert: async ({ transaction }) => {
      for (const m of transaction.mutations) {
        await saveMindMapFn({ data: { bookId: m.modified.bookId, graph: m.modified.graph } });
      }
    },
    onUpdate: async ({ transaction }) => {
      for (const m of transaction.mutations) {
        await saveMindMapFn({ data: { bookId: m.modified.bookId, graph: m.modified.graph } });
      }
    },
  }),
);
