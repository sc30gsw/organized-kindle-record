import { useSuspenseQuery } from "@tanstack/react-query";
import { Anchor, Badge, Box, Button, Group, Image, Stack, Text, Title } from "@mantine/core";
import { bookHighlightsQueryOptions } from "@/features/books/api/book-highlights-query";
import { STATUS_COLOR, StatusBadge } from "@/features/books/components/status-badge";
import type { BookRowValues } from "@/features/books/schemas/book-schema";

type HighlightPanelProps = {
  book: BookRowValues;
  onQuoteToNode: (quote: string) => void;
};

export function HighlightPanel({ book, onQuoteToNode }: HighlightPanelProps) {
  const { data } = useSuspenseQuery(bookHighlightsQueryOptions(book.id));
  const { highlights, mentalMap } = data;

  return (
    <Stack p="md" gap="md" style={{ height: "100%", overflow: "auto" }}>
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
          <Anchor href={book.pageUrl} target="_blank" rel="noreferrer" size="sm">
            Notion で開く ↗
          </Anchor>
        </Stack>
      </Group>

      {mentalMap.length > 0 ? (
        <Stack gap={4} p="sm" bg="gray.0" style={{ borderRadius: 8 }}>
          <Title order={5}>メンタルマップ</Title>
          {mentalMap.map((line, i) => (
            <Text key={i} size="sm">
              {line}
            </Text>
          ))}
        </Stack>
      ) : null}

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
    </Stack>
  );
}
