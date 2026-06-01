import { createFileRoute, stripSearchParams } from '@tanstack/react-router';
import { valibotValidator } from '@tanstack/valibot-adapter';
import { booksCollection } from '@/features/books/collections';
import { defaultSearchParams, searchSchema } from '@/features/books/schemas/search-schema';
import { BooksPage } from '@/features/books/components/books-page';

export const Route = createFileRoute('/')({
  validateSearch: valibotValidator(searchSchema),
  search: {
    middlewares: [stripSearchParams(defaultSearchParams)],
  },
  // SSR の初回ペイントに表データを載せるため collection を preload
  loader: async () => {
    await booksCollection.preload();
  },
  component: BooksPage,
});
