import { Suspense } from "react";
import { ClientOnly, createFileRoute, Link, stripSearchParams } from "@tanstack/react-router";
import { valibotValidator } from "@tanstack/valibot-adapter";
import { eq } from "@tanstack/db";
import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { Alert, Button, Center, Container, Group, Loader } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { booksCollection } from "@/features/books/collections";
import { bookHighlightsQueryOptions } from "@/features/books/api/book-highlights-query";
import { HighlightPanel } from "@/features/books/components/highlight-panel";
import { mindMapCollection } from "@/features/mind-map/collections";
import { MindMapCanvas } from "@/features/mind-map/components/mind-map-canvas";
import { useMindMap } from "@/features/mind-map/hooks/use-mind-map";
import {
  bookDetailSearchSchema,
  defaultBookDetailSearchParams,
} from "@/features/mind-map/schemas/wheel-mode-schema";
import { SplitView } from "@/components/split-view";
import { queryClient } from "@/lib/query-client";
import type { MindMapGraph } from "@/lib/db/schema";

export const Route = createFileRoute("/_authenticated/books/$bookId")({
  validateSearch: valibotValidator(bookDetailSearchSchema),
  search: {
    middlewares: [stripSearchParams(defaultBookDetailSearchParams)],
  },
  loader: async ({ params }) => {
    await booksCollection.preload();
    await mindMapCollection.preload();
    await queryClient.ensureQueryData(bookHighlightsQueryOptions(params.bookId));
  },
  component: BookDetailPage,
  errorComponent: BookDetailError,
});

function PageLoader() {
  return (
    <Center h="100%">
      <Loader />
    </Center>
  );
}

function BookDetailError({ error }: Record<"error", Error>) {
  return (
    <Container size="xl" py="md">
      <Alert color="red" title="読み込みエラー">
        {error.message}
      </Alert>
    </Container>
  );
}

function BookDetailPage() {
  return (
    <div className="flex h-[calc(100vh-16px)] flex-col p-2">
      <Group mb="xs">
        <Button
          leftSection={<IconArrowLeft size={16} />}
          renderRoot={(props) => <Link to="/" {...props} />}
          size="xs"
          variant="subtle"
        >
          一覧に戻る
        </Button>
      </Group>
      <div className="min-h-0 flex-1">
        <ClientOnly fallback={<PageLoader />}>
          <Suspense fallback={<PageLoader />}>
            <BookDetail />
          </Suspense>
        </ClientOnly>
      </div>
    </div>
  );
}

function BookDetail() {
  const { bookId } = Route.useParams();
  const { wheel } = Route.useSearch();
  const navigate = Route.useNavigate();

  const { data: books } = useLiveSuspenseQuery(
    (q) => q.from({ book: booksCollection }).where(({ book }) => eq(book.id, bookId)),
    [bookId],
  );
  const { data: maps } = useLiveSuspenseQuery(
    (q) => q.from({ m: mindMapCollection }).where(({ m }) => eq(m.bookId, bookId)),
    [bookId],
  );

  const book = books[0];
  const initialGraph = (maps[0]?.graph ?? null) as MindMapGraph | null;
  const mm = useMindMap({ bookId, bookTitle: book?.title ?? "", initialGraph });

  if (!book) {
    return (
      <Alert color="red" title="本が見つかりません">
        指定された本は存在しません。
      </Alert>
    );
  }

  return (
    <SplitView
      left={
        <Suspense fallback={<PageLoader />}>
          <HighlightPanel book={book} onQuoteToNode={mm.addNode} />
        </Suspense>
      }
      right={
        <MindMapCanvas
          exportFileName={book?.title ?? "mind-map"}
          nodes={mm.nodes}
          edges={mm.edges}
          onNodesChange={mm.onNodesChange}
          onEdgesChange={mm.onEdgesChange}
          onConnect={mm.onConnect}
          onReconnect={mm.onReconnect}
          onInit={mm.setRfInstance}
          onAddNode={() => mm.addNode()}
          onWheelModeChange={(mode) =>
            navigate({ search: (prev) => ({ ...prev, wheel: mode }), replace: true })
          }
          wheelMode={wheel}
        />
      }
    />
  );
}
