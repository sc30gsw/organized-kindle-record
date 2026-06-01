import { createFileRoute, stripSearchParams } from '@tanstack/react-router';
import { valibotValidator } from '@tanstack/valibot-adapter';
import { Alert, Container } from '@mantine/core';
import { booksCollection } from '@/features/books/collections';
import { defaultSearchParams, searchSchema } from '@/features/books/schemas/search-schema';
import { BooksPage } from '@/features/books/components/books-page';

function BooksError({ error }: Record<'error', Error>) {
  return (
    <Container size="xl" py="md">
      <Alert color="red" title="読み込みエラー">
        {error.message}
      </Alert>
    </Container>
  );
}

export const Route = createFileRoute('/_authenticated/')({
  validateSearch: valibotValidator(searchSchema),
  search: {
    middlewares: [stripSearchParams(defaultSearchParams)],
  },
  loader: async () => {
    await booksCollection.preload();
  },
  component: BooksPage,
  errorComponent: BooksError,
});
