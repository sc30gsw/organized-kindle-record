import { useForm } from "@tanstack/react-form";
import { Group, Select, TextInput } from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { getRouteApi } from "@tanstack/react-router";
import {
  BooksSearch,
  BooksSearchInput,
  searchSchema,
  STATUS_OPTIONS,
} from "@/features/books/schemas/search-schema";

const routeApi = getRouteApi("/_authenticated/");

/** 検索フォーム。値は URL search params が真実。text は debounce、status は即時。 */
export function BooksSearchForm() {
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();

  const debouncedQ = useDebouncedCallback(
    (q: BooksSearchInput["q"]) => navigate({ search: (prev) => ({ ...prev, q }) }),
    300,
  );

  const defaultValues: BooksSearchInput = { q: search.q, status: search.status };

  const form = useForm({
    defaultValues,
    validators: {
      onChange: searchSchema,
    },
    onSubmit: ({ value }) =>
      navigate({ search: (prev) => ({ ...prev, q: value.q, status: value.status }) }),
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
              value={field.state.value ?? ""}
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
              value={field.state.value ?? null}
              onChange={(v) => {
                const status = (v ?? undefined) as BooksSearch["status"];

                field.handleChange(status);
                navigate({ search: (prev) => ({ ...prev, status }) });
              }}
              w={160}
            />
          )}
        </form.Field>
      </Group>
    </form>
  );
}
