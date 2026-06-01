import { Suspense } from "react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { eq } from "@tanstack/db";
import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { Alert, Container, Loader } from "@mantine/core";
import { booksCollection } from "@/features/books/collections";
import { bookHighlightsQueryOptions } from "@/features/books/api/book-highlights-query";
import { HighlightPanel } from "@/features/books/components/highlight-panel";
import { mindMapCollection } from "@/features/mind-map/collections";
import { MindMapCanvas } from "@/features/mind-map/components/mind-map-canvas";
import { useMindMap } from "@/features/mind-map/hooks/use-mind-map";
import { SplitView } from "@/components/split-view";
import { queryClient } from "@/lib/query-client";
import type { MindMapGraph } from "@/lib/db/schema";

export const Route = createFileRoute("/_authenticated/books/$bookId")({
  loader: async ({ params }) => {
    await booksCollection.preload();
    await mindMapCollection.preload();
    await queryClient.ensureQueryData(bookHighlightsQueryOptions(params.bookId));
  },
  component: BookDetailPage,
  errorComponent: BookDetailError,
});

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
    <div className="h-[calc(100vh-16px)] p-2">
      <ClientOnly fallback={<Loader />}>
        <Suspense fallback={<Loader />}>
          <BookDetail />
        </Suspense>
      </ClientOnly>
    </div>
  );
}

function BookDetail() {
  const { bookId } = Route.useParams();

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
        <Suspense fallback={<Loader />}>
          <HighlightPanel book={book} onQuoteToNode={mm.addNode} />
        </Suspense>
      }
      right={
        <MindMapCanvas
          nodes={mm.nodes}
          edges={mm.edges}
          onNodesChange={mm.onNodesChange}
          onEdgesChange={mm.onEdgesChange}
          onConnect={mm.onConnect}
          onInit={mm.setRfInstance}
          onAddNode={() => mm.addNode("新しいノード")}
        />
      }
    />
  );
}
