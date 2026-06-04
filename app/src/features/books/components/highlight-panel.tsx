import { useSuspenseQuery } from "@tanstack/react-query";
import { useDisclosure } from "@mantine/hooks";
import { Anchor, Badge, Box, Button, Group, Image, Stack, Text, Title } from "@mantine/core";
import { bookHighlightsQueryOptions } from "@/features/books/api/book-highlights-query";
import { MentalMapModal } from "@/features/books/components/mental-map-modal";
import { STATUS_COLOR, StatusBadge } from "@/features/books/components/status-badge";
import type { BookRowValues } from "@/features/books/schemas/book-schema";
import { useMindMap } from "@/features/mind-map/hooks/use-mind-map";

type HighlightPanelProps = {
  book: BookRowValues;
  onQuoteToNode: ReturnType<typeof useMindMap>["addNode"];
};

export function HighlightPanel({ book, onQuoteToNode }: HighlightPanelProps) {
  const { data } = useSuspenseQuery(bookHighlightsQueryOptions(book.id));
  const { highlights, mentalMap } = data;
  const [mmOpened, mmHandlers] = useDisclosure(false);

  return (
    <Stack
      p="md"
      gap="md"
      style={{ height: "100%", overflow: "auto", overscrollBehavior: "contain" }}
    >
      <Group align="flex-start" wrap="nowrap">
        {book.coverUrl ? <Image src={book.coverUrl} alt="" w={64} h={90} fit="contain" /> : null}
        <Stack gap={4}>
          <Title order={4}>{book.title}</Title>
          <Text size="sm" c="dimmed">
            {book.authors.join(", ")}
          </Text>
          <Group gap="xs">
            {book.status ? <StatusBadge status={book.status as keyof typeof STATUS_COLOR} /> : null}
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
        {highlights.map((h, i) => (
          <Box key={i} p="sm" style={{ borderLeft: "3px solid var(--mantine-color-blue-4)" }}>
            <Text size="sm">{h.quote}</Text>
            {h.notes.map((n, j) => (
              <Text key={j} size="xs" c="dimmed" ml="sm">
                ・{n}
              </Text>
            ))}
            <Button
              size="compact-xs"
              variant="subtle"
              mt={4}
              onClick={() => onQuoteToNode(h.quote)}
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
