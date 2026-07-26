import { Badge, type MantineColor } from "@mantine/core";
import type { ReadingStatus } from "@/features/books/schemas/book-schema";

/** satisfies により、ステータスが増えたら配色の追加漏れがコンパイルエラーになる。 */
const STATUS_COLOR = {
  未読: "gray",
  読書中: "blue",
  読了: "green",
  再読: "grape",
} as const satisfies Record<ReadingStatus, MantineColor>;

export function StatusBadge({ status }: Record<"status", ReadingStatus | null>) {
  if (status === null) {
    return null;
  }

  return (
    <Badge color={STATUS_COLOR[status]} variant="light">
      {status}
    </Badge>
  );
}
