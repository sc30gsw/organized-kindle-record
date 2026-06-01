import { useForm } from '@tanstack/react-form';
import { Group, Select, TextInput } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { getRouteApi } from '@tanstack/react-router';
import { STATUS_OPTIONS } from '@/features/books/schemas/search-schema';

const routeApi = getRouteApi('/');

/** 検索フォーム。値は URL search params が真実。text は debounce、status は即時。 */
export function BooksSearchForm() {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();

  const pushSearch = (next: { q?: string; status?: string | undefined }) => {
    navigate({ search: (prev) => ({ ...prev, ...next }) });
  };
  const debouncedQ = useDebouncedCallback((q: string) => pushSearch({ q }), 300);

  const form = useForm({
    defaultValues: { q: search.q ?? '', status: search.status ?? '' },
    onSubmit: ({ value }) => pushSearch({ q: value.q, status: value.status || undefined }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <Group>
        <form.Field name="q">
          {(field) => (
            <TextInput
              placeholder="タイトル・著者で検索"
              value={field.state.value}
              onChange={(e) => {
                field.handleChange(e.currentTarget.value);
                debouncedQ(e.currentTarget.value);
              }}
              w={280}
            />
          )}
        </form.Field>
        <form.Field name="status">
          {(field) => (
            <Select
              placeholder="ステータス"
              clearable
              data={[...STATUS_OPTIONS]}
              value={field.state.value || null}
              onChange={(v) => {
                field.handleChange(v ?? '');
                pushSearch({ status: v ?? undefined });
              }}
              w={160}
            />
          )}
        </form.Field>
      </Group>
    </form>
  );
}
