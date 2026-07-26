import { useLiveQuery } from "@tanstack/react-db";
import { useForm } from "@tanstack/react-form";
import {
  Alert,
  Anchor,
  Badge,
  Blockquote,
  Button,
  Center,
  Group,
  Image,
  List,
  Loader,
  ScrollArea,
  Select,
  Stack,
  TagsInput,
  Text,
  TextInput,
} from "@mantine/core";
import { booksCollection } from "@/features/books/collections";
import { findBookCandidates } from "@/features/books/lib/match-existing-book";
import { READING_STATUS_NAMES } from "@/features/books/schemas/book-schema";
import { CREATE_TARGET_VALUE, pasteFormSchema } from "@/features/books/schemas/paste-import-schema";
import type {
  PasteFormInput,
  PasteOverrides,
  PasteTarget,
} from "@/features/books/schemas/paste-import-schema";
import type { BookRowValues } from "@/features/books/schemas/book-schema";
import type { PastedPreview } from "@/features/books/server/parse-pasted-fn";

type PastePreviewStepProps = {
  isPending: boolean;
  onBack: () => void;
  onSubmit: (input: { overrides: PasteOverrides; target: PasteTarget }) => void;
  preview: PastedPreview;
};

type PastePreviewFormProps = PastePreviewStepProps & Record<"rows", BookRowValues[]>;

const FORMAT_LABEL = {
  html: "HTML エクスポート",
  markdown: "Copy Markdown",
} as const satisfies Record<PastedPreview["format"], string>;

/**
 * ペースト内容の確認ステップ。
 *
 * 取込先の候補は既に読み込まれている一覧から作るので、Notion への往復は増えない。
 * 一覧が揃うまでフォームを出さないのは、既存ページの自動選択が
 * defaultValues の初期化時にしか効かないため（後から届いても選び直されない）。
 */
export function PastePreviewStep(props: PastePreviewStepProps) {
  const { data: rows, isReady } = useLiveQuery((query) => query.from({ book: booksCollection }));

  if (!isReady) {
    return (
      <Center mih={120}>
        <Loader />
      </Center>
    );
  }

  return <PastePreviewForm {...props} rows={rows} />;
}

/**
 * Web Highlights の書き出しは著者 / ASIN / 日付を落とすため、ここが唯一の補完地点。
 * 取込先は ASIN で自動解決できないので、必ず「新規作成 or 追記先」を確定させる。
 */
function PastePreviewForm({ isPending, onBack, onSubmit, preview, rows }: PastePreviewFormProps) {
  const { book, format, unsupportedBlockCount, rawTags } = preview;

  const candidates = findBookCandidates(book.title, rows);
  const autoSelected = candidates.length === 1 ? candidates[0] : undefined;

  const defaultValues: PasteFormInput = {
    title: book.title,
    authors: book.authors,
    asin: book.asin ?? "",
    tags: book.tags,
    lastUpdated: book.lastUpdated ?? "",
    status: "",
    targetPageId: autoSelected?.id ?? CREATE_TARGET_VALUE,
  };

  const form = useForm({
    defaultValues,
    validators: {
      onChange: pasteFormSchema,
    },
    onSubmit: ({ value }) =>
      onSubmit({
        target:
          value.targetPageId === CREATE_TARGET_VALUE
            ? { kind: "create" }
            : { kind: "append", pageId: value.targetPageId },
        overrides: {
          title: value.title,
          authors: value.authors,
          asin: value.asin || null,
          tags: value.tags,
          lastUpdated: value.lastUpdated || null,
          status: value.status || null,
        },
      }),
  });

  // 並びは一覧の取得順そのまま。件数が増えても Select の searchable で辿れる
  const targetOptions = [
    { value: CREATE_TARGET_VALUE, label: "新規作成" },
    ...rows.map((row) => ({ value: row.id, label: row.title })),
  ];

  // ハイライトは Notion のブロック id を持たない（CLI と共有する素の string[]）ため、
  // 本文と出現順から安定キーを組み立てておく
  const highlightItems = book.highlights.map((highlight, index) => ({
    key: `${highlight.text.slice(0, 32)}#${index}`,
    text: highlight.text,
    notes: highlight.notes.map((note, noteIndex) => ({
      key: `${note.slice(0, 32)}#${index}.${noteIndex}`,
      text: note,
    })),
  }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <Stack>
        <Group align="flex-start" wrap="nowrap">
          {book.coverUrl ? <Image src={book.coverUrl} alt="" w={56} h={80} fit="contain" /> : null}
          <Stack gap="xs">
            <Group gap="xs">
              <Badge variant="light">{FORMAT_LABEL[format]}</Badge>
              <Badge variant="light" color="teal">
                ハイライト {book.highlights.length}
              </Badge>
            </Group>
            {book.bookUrl === null ? null : (
              <Anchor href={book.bookUrl} target="_blank" rel="noreferrer" size="sm" truncate="end">
                書き出し元を開く ↗
              </Anchor>
            )}
          </Stack>
        </Group>

        {autoSelected === undefined ? null : (
          <Alert color="blue" variant="light" title="既存ページを自動選択しました">
            「{autoSelected.title}
            」に未登録のハイライトだけを追記します。別の本として登録する場合は取込先を変更してください。
          </Alert>
        )}

        {candidates.length > 1 && (
          <Alert color="yellow" variant="light" title="同名の既存ページが複数あります">
            自動選択していません。追記先を選ぶか、新規作成を選んでください。
          </Alert>
        )}

        {unsupportedBlockCount > 0 && (
          <Alert color="orange" variant="light" title="未対応ブロックを無視しました">
            引用以外のブロック {unsupportedBlockCount} 個は取り込みません。
          </Alert>
        )}

        <form.Field name="targetPageId">
          {(field) => (
            <Select
              label="取込先"
              data={targetOptions}
              value={field.state.value}
              onChange={(value) => field.handleChange(value ?? CREATE_TARGET_VALUE)}
              onBlur={field.handleBlur}
              searchable
              nothingFoundMessage="一致する本がありません"
              disabled={isPending}
            />
          )}
        </form.Field>

        <form.Field name="title">
          {(field) => (
            <TextInput
              label="タイトル"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.currentTarget.value)}
              onBlur={field.handleBlur}
              error={field.state.meta.errors[0]?.message}
              disabled={isPending}
            />
          )}
        </form.Field>

        <form.Field name="authors">
          {(field) => (
            <TagsInput
              label="著者"
              description="Web Highlights は著者を書き出さないため、必要なら手入力する"
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              disabled={isPending}
            />
          )}
        </form.Field>

        <Group grow align="flex-start">
          <form.Field name="asin">
            {(field) => (
              <TextInput
                label="ASIN（任意）"
                description="入れておくと次回以降は ASIN で同じページに紐づく"
                placeholder="B0CFQZ1J8Q"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]?.message}
                disabled={isPending}
              />
            )}
          </form.Field>

          <form.Field name="lastUpdated">
            {(field) => (
              <TextInput
                type="date"
                label="最終更新日"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]?.message}
                disabled={isPending}
              />
            )}
          </form.Field>
        </Group>

        <Group grow align="flex-start">
          <form.Field name="tags">
            {(field) => (
              <TagsInput
                label="タグ"
                description={rawTags === null ? undefined : `書き出しのタグ欄: ${rawTags}`}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
                disabled={isPending}
              />
            )}
          </form.Field>

          <form.Field name="status">
            {(field) => (
              <Select
                label="読了ステータス"
                description="新規作成時のみ反映（既存ページは変更しない）"
                data={[...READING_STATUS_NAMES]}
                value={field.state.value || null}
                onChange={(value) => field.handleChange(value ?? "")}
                onBlur={field.handleBlur}
                clearable
                disabled={isPending}
              />
            )}
          </form.Field>
        </Group>

        <Text fw={600} size="sm">
          ハイライト {book.highlights.length} 件
        </Text>
        <ScrollArea.Autosize mah={280} type="auto">
          <Stack gap="xs">
            {highlightItems.map((highlight) => (
              <Blockquote key={highlight.key} p="sm" color="blue">
                <Text size="sm" className="whitespace-pre-wrap">
                  {highlight.text}
                </Text>
                {highlight.notes.length > 0 && (
                  <List size="xs" c="dimmed" mt={4}>
                    {highlight.notes.map((note) => (
                      <List.Item key={note.key}>
                        <span className="whitespace-pre-wrap">{note.text}</span>
                      </List.Item>
                    ))}
                  </List>
                )}
              </Blockquote>
            ))}
          </Stack>
        </ScrollArea.Autosize>

        <Group justify="flex-end">
          <Button variant="default" onClick={onBack} disabled={isPending}>
            戻る
          </Button>
          <Button type="submit" loading={isPending}>
            Notion に取り込む
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
