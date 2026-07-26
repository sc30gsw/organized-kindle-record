/**
 * 折りたたみ状態の導出。React にも react-flow にも依存しない純関数として切り出してある
 * （仕様が濃い割にフック内では検証できなかったため）。
 * 引数は必要なフィールドだけを構造的に要求するので、テストは素のオブジェクトで書ける。
 */

type CollapseNode = {
  data: { collapsed?: boolean | undefined };
  id: string;
  type?: string | undefined;
};

type CollapseEdge = {
  source: string;
  target: string;
};

/** アンカーとして最優先するノード種別（＝本のタイトルノード）。 */
const ANCHOR_NODE_TYPE = "title";

/**
 * ルート基準の折りたたみ導出状態。エッジの向き（どちらからドラッグしたか）は見ず、
 * 無向グラフとして「ルートに近い側が親」で判定する。
 * - アンカー: タイトルノード。タイトルと繋がっていない島は、その島で最初に作られたノード
 * - hiddenNodeIds: アンカーから折りたたみノード（data.collapsed）を越えずに辿れないノード id
 * - hiddenDescendantCounts: 折りたたみノード id → そこに接する隠れ領域のノード数（Miro 風「+N」チップ用）
 * - hiddenRegionByCollapsedId: 折りたたみノード id → 隠れ領域のノード id 集合（ドラッグ追従用）
 */
export function computeCollapseState(
  nodes: readonly CollapseNode[],
  edges: readonly CollapseEdge[],
) {
  const neighborsOf = new Map<string, string[]>();
  for (const edge of edges) {
    neighborsOf.set(edge.source, [...(neighborsOf.get(edge.source) ?? []), edge.target]);
    neighborsOf.set(edge.target, [...(neighborsOf.get(edge.target) ?? []), edge.source]);
  }

  const collapsedIds = new Set<string>();
  // アンカー（タイトルノード）を先に並べた探索順。走査は 1 回で両方を作る
  const anchorIds: string[] = [];
  const otherIds: string[] = [];
  for (const node of nodes) {
    if (node.data.collapsed === true) {
      collapsedIds.add(node.id);
    }

    if (node.type === ANCHOR_NODE_TYPE) {
      anchorIds.push(node.id);
    } else {
      otherIds.push(node.id);
    }
  }

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
  const orderedIds = [...anchorIds, ...otherIds];
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

  const hiddenNodeIds = new Set<string>();
  for (const node of nodes) {
    if (!visible.has(node.id)) {
      hiddenNodeIds.add(node.id);
    }
  }

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
