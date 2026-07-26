import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { valibotValidator } from "@tanstack/valibot-adapter";
import { defaultSearchParams, searchSchema } from "@/features/books/schemas/search-schema";
import { BooksPage } from "@/features/books/components/books-page";
import { RouteError } from "@/components/route-error";

// データ取得はクライアント（ClientOnly + Suspense）に一本化している。
// loader でサーバー取得すると本体のクライアント取得と二重になり、Notion 往復が 2 倍になる。
// また loader はサーバーからモジュールシングルトンな collection に触る唯一の経路でもあった。
export const Route = createFileRoute("/_authenticated/")({
  validateSearch: valibotValidator(searchSchema),
  search: {
    middlewares: [stripSearchParams(defaultSearchParams)],
  },
  component: BooksPage,
  errorComponent: RouteError,
});
