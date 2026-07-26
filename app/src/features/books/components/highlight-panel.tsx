import { useSuspenseQuery } from "@tanstack/react-query";
import { useDisclosure } from "@mantine/hooks";
import { Anchor, Badge, Box, Button, Group, Image, Stack, Text, Title } from "@mantine/core";
import { bookHighlightsQueryOptions } from "@/features/books/api/book-highlights-query";
import { MentalMapModal } from "@/features/books/components/mental-map-modal";
import { StatusBadge } from "@/features/books/components/status-badge";
import { selectedTextWithin } from "@/features/books/lib/selected-text";
import type { BookRowValues } from "@/features/books/schemas/book-schema";

/**
 * notes は CLI 側と共有する `Highlight['notes']`（ただの string[]）でブロック id を持たない。
 * key に添字をそのまま使わないよう、本文と並び順から安定キーを先に組み立てる。
 */
function keyedNotes(highlightId: string, notes: readonly string[]) {
  return notes.map((text, index) => ({
    key: `${highlightId}:${text.slice(0, 32)}#${index}`,
    text,
  }));
}

type HighlightPanelProps = {
  book: BookRowValues;
  // mind-map feature の型を借りると feature 間依存になるため、ここで平坦に宣言する
  onQuoteToNode: (label: string) => void;
};

export function HighlightPanel({ book, onQuoteToNode }: HighlightPanelProps) {
  const { data } = useSuspenseQuery(bookHighlightsQueryOptions(book.id));
  const { highlights, mentalMap } = data;
  const [mmOpened, mmHandlers] = useDisclosure(false);

  return (
    <Stack p="md" gap="md" className="h-full overflow-auto overscroll-contain">
      <Group align="flex-start" wrap="nowrap">
        {book.coverUrl ? <Image src={book.coverUrl} alt="" w={64} h={90} fit="contain" /> : null}
        <Stack gap={4}>
          <Title order={4}>{book.title}</Title>
          <Text size="sm" c="dimmed">
            {book.authors.join(", ")}
          </Text>
          <Group gap="xs">
            <StatusBadge status={book.status} />
            <Badge variant="light">ハイライト {book.highlightCount}</Badge>
          </Group>
          <Group gap="xs">
            <Anchor href={book.pageUrl} target="_blank" rel="noreferrer" size="sm">
              Notion で開く ↗
            </Anchor>
            {mentalMap.length > 0 ? (
              <Button color="teal" onClick={mmHandlers.open} size="compact-xs" variant="light">
                メンタルマップ
              </Button>
            ) : null}
          </Group>
        </Stack>
      </Group>

      <Stack gap="sm">
        {highlights.map((h) => (
          <Box
            key={h.id}
            p="sm"
            // 見た目は既存デザインを維持する（Phase 0 は挙動も見た目も変えない方針）
            // react-doctor-disable-next-line react-doctor/no-side-tab-border
            style={{ borderLeft: "3px solid var(--mantine-color-blue-4)" }}
          >
            <Text size="sm">{h.quote}</Text>
            {keyedNotes(h.id, h.notes).map((note) => (
              <Text key={note.key} size="xs" c="dimmed" ml="sm">
                ・{note.text}
              </Text>
            ))}
            <Button
              size="compact-xs"
              variant="subtle"
              mt={4}
              // mousedown のデフォルト動作でテキスト選択が解除されるのを防ぐ
              onMouseDown={(e) => e.preventDefault()}
              // このハイライト Box 内で選択中の文字列があればそれだけをノード化、なければ全文
              onClick={(e) =>
                onQuoteToNode(
                  selectedTextWithin(window.getSelection(), e.currentTarget.parentElement, h.quote),
                )
              }
            >
              ノード化
            </Button>
          </Box>
        ))}
      </Stack>

      <MentalMapModal
        items={mentalMap}
        onClose={mmHandlers.close}
        onQuoteToNode={onQuoteToNode}
        opened={mmOpened}
      />
    </Stack>
  );
}
