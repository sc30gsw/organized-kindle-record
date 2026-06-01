import { useRef, useState } from 'react';
import { Anchor, Image, Table, Text } from '@mantine/core';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from '@formkit/tempo';
import { StatusBadge } from '@/features/books/components/status-badge';
import type { BookRow } from '@/features/books/types';

const col = createColumnHelper<BookRow>();

const columns = [
  col.accessor('coverUrl', {
    header: '表紙',
    enableSorting: false,
    cell: (c) =>
      c.getValue() ? (
        <Image src={c.getValue()!} alt="" w={40} h={56} fit="contain" />
      ) : (
        <Text c="dimmed" size="xs">
          —
        </Text>
      ),
  }),
  col.accessor('title', {
    header: 'タイトル',
    cell: (c) => (
      <Anchor href={c.row.original.pageUrl} target="_blank" rel="noreferrer">
        {c.getValue()}
      </Anchor>
    ),
  }),
  col.accessor('authors', {
    header: '著者',
    enableSorting: false,
    cell: (c) => c.getValue().join(', '),
  }),
  col.accessor('status', {
    header: 'ステータス',
    cell: (c) => <StatusBadge status={c.getValue()} />,
  }),
  col.accessor('amazonUrl', {
    header: 'Amazon',
    enableSorting: false,
    cell: (c) =>
      c.getValue() ? (
        <Anchor href={c.getValue()!} target="_blank" rel="noreferrer">
          リンク
        </Anchor>
      ) : null,
  }),
  col.accessor('highlightCount', { header: 'ハイライト' }),
  col.accessor('lastUpdated', {
    header: '最終更新',
    cell: (c) => (c.getValue() ? format(c.getValue()!, 'YYYY/MM/DD') : '—'),
  }),
];

export function BooksTable({ data }: { data: BookRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'lastUpdated', desc: true }]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  return (
    <div ref={parentRef} style={{ height: '70vh', overflow: 'auto' }}>
      <Table stickyHeader>
        <Table.Thead>
          {table.getHeaderGroups().map((hg) => (
            <Table.Tr key={hg.id}>
              {hg.headers.map((h) => (
                <Table.Th
                  key={h.id}
                  onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                  style={{ cursor: h.column.getCanSort() ? 'pointer' : undefined }}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {({ asc: ' ▲', desc: ' ▼' } as Record<string, string>)[
                    h.column.getIsSorted() as string
                  ] ?? ''}
                </Table.Th>
              ))}
            </Table.Tr>
          ))}
        </Table.Thead>
        <Table.Tbody style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const row = rows[vi.index]!;
            return (
              <Table.Tr
                key={row.id}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  transform: `translateY(${vi.start}px)`,
                  width: '100%',
                  display: 'table',
                  tableLayout: 'fixed',
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <Table.Td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Table.Td>
                ))}
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </div>
  );
}
