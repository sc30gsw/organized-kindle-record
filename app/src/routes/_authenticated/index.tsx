import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { valibotValidator } from "@tanstack/valibot-adapter";
import { Alert, Container } from "@mantine/core";
import { defaultSearchParams, searchSchema } from "@/features/books/schemas/search-schema";
import { BooksPage } from "@/features/books/components/books-page";

function BooksError({ error }: Record<"error", Error>) {
  return (
    <Container size="xl" py="md">
      <Alert color="red" title="読み込みエラー">
        {error.message}
      </Alert>
    </Container>
  );
}

// データ取得はクライアント（ClientOnly + Suspense）に一本化している。
// loader でサーバー取得すると本体のクライアント取得と二重になり、Notion 往復が 2 倍になる。
// また loader はサーバーからモジュールシングルトンな collection に触る唯一の経路でもあった。
export const Route = createFileRoute("/_authenticated/")({
  validateSearch: valibotValidator(searchSchema),
  search: {
    middlewares: [stripSearchParams(defaultSearchParams)],
  },
  component: BooksPage,
  errorComponent: BooksError,
});
