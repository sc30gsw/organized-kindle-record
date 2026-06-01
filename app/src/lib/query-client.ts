import { QueryClient } from '@tanstack/react-query';

/** TanStack DB collection の土台。staleTime でナビ毎の Notion 再叩きを抑える。 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000 },
  },
});
