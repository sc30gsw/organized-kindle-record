import { getRouteApi } from "@tanstack/react-router";

/**
 * 一覧ページの route API。
 *
 * 検索状態の読み方はこの規則で統一している:
 * - route ファイル自身（src/routes/**）は `Route.useSearch()` を使う
 * - それ以外（feature の hooks / components）は getRouteApi を使い、
 *   route id の文字列リテラルはここ 1 箇所だけに置く
 */
export const booksRouteApi = getRouteApi("/_authenticated/");
