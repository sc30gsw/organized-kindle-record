import { Badge } from '@mantine/core';

const COLOR: Record<string, string> = {
  未読: 'gray',
  読書中: 'blue',
  読了: 'green',
  再読: 'grape',
};

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  return (
    <Badge color={COLOR[status] ?? 'gray'} variant="light">
      {status}
    </Badge>
  );
}
