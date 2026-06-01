import { HighlightPanel } from "@/features/books/components/highlight-panel";
import { Box, Button, Group, Modal, Stack, Text } from "@mantine/core";
import type { UseDisclosureReturnValue } from "@mantine/hooks";
import { getBookHighlights } from "~/get-book-highlights";

type MentalMapModalProps = {
  items: Awaited<ReturnType<typeof getBookHighlights>>["mentalMap"];
  onClose: UseDisclosureReturnValue[1]["close"];
  onQuoteToNode: Parameters<typeof HighlightPanel>[0]["onQuoteToNode"];
  opened: UseDisclosureReturnValue[0];
};

/** メンタルマップ（H2 セクション）を質問ごとに構造化して表示し、各項目をノード化できる Modal。 */
export function MentalMapModal({ items, onClose, onQuoteToNode, opened }: MentalMapModalProps) {
  return (
    <Modal onClose={onClose} opened={opened} size="lg" title="メンタルマップ">
      <Stack gap="lg">
        {items.map((item, i) => (
          <Box key={i} style={{ borderLeft: "3px solid var(--mantine-color-teal-4)" }} pl="sm">
            <Group align="flex-start" gap="xs" justify="space-between" wrap="nowrap">
              <Text fw={600} size="sm">
                {item.question}
              </Text>
              <Button
                onClick={() => onQuoteToNode(item.question)}
                size="compact-xs"
                variant="light"
              >
                ノード化
              </Button>
            </Group>
            <Stack gap={4} mt="xs">
              {item.answers.map((answer, j) => (
                <Group key={j} align="flex-start" gap="xs" justify="space-between" wrap="nowrap">
                  <Text size="sm">・{answer}</Text>
                  <Button
                    onClick={() => onQuoteToNode(answer)}
                    size="compact-xs"
                    variant="subtle"
                  >
                    ノード化
                  </Button>
                </Group>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Modal>
  );
}
