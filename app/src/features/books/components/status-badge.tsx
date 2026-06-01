import { Badge } from '@mantine/core';

export const STATUS_COLOR = {
  未読: 'gray',
  読書中: 'blue',
  読了: 'green',
  再読: 'grape',
} as const satisfies Record<string, string>;

export function StatusBadge({ status }: Record<'status', keyof typeof STATUS_COLOR>) {
  return (
    <Badge color={STATUS_COLOR[status as keyof typeof STATUS_COLOR] ?? 'gray'} variant="light">
      {status}
    </Badge>
  );
}
