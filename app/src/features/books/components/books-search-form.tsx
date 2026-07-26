import { useForm } from "@tanstack/react-form";
import { Group, Select, TextInput } from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { booksRouteApi } from "@/features/books/route-api";
import {
  searchSchema,
  STATUS_OPTIONS,
  type BooksSearch,
  type BooksSearchInput,
} from "@/features/books/schemas/search-schema";

/** 検索フォーム。値は URL search params が真実。text は debounce、status は即時。 */
export function BooksSearchForm() {
  const navigate = booksRouteApi.useNavigate();
  const search = booksRouteApi.useSearch();

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
    // TanStack Form v1 の submit 規約（valibot-validation.md）。
    // 認証必須で CSR 前提の管理 UI なので、JS 無しの progressive enhancement は要件外
    // react-doctor-disable-next-line react-doctor/no-prevent-default
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
