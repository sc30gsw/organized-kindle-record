import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Anchor, Image, Table, Text } from "@mantine/core";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "@formkit/tempo";
import { StatusBadge } from "@/features/books/components/status-badge";
import type { BookRowValues } from "@/features/books/schemas/book-schema";

const col = createColumnHelper<BookRowValues>();

/** ソート方向の表示。getIsSorted() は false | 'asc' | 'desc' を返す。 */
const SORT_MARK = { asc: " ▲", desc: " ▼" } as const;

function sortMark(sorted: false | "asc" | "desc") {
  return sorted === false ? "" : SORT_MARK[sorted];
}

const columns = [
  col.accessor("coverUrl", {
    header: "表紙",
    size: 56,
    enableSorting: false,
    cell: (c) => {
      const coverUrl = c.getValue();

      return coverUrl === null ? (
        <Text c="dimmed" size="xs">
          —
        </Text>
      ) : (
        <Image src={coverUrl} alt="" w={40} h={56} fit="contain" />
      );
    },
  }),
  col.accessor("title", {
    header: "タイトル",
    size: 360,
    cell: (c) => (
      <Anchor
        display="block"
        renderRoot={(props) => (
          <Link params={{ bookId: c.row.original.id }} to="/books/$bookId" {...props} />
        )}
        title={c.getValue()}
        truncate="end"
      >
        {c.getValue()}
      </Anchor>
    ),
  }),
  col.accessor("authors", {
    header: "著者",
    size: 160,
    enableSorting: false,
    cell: (c) => (
      <Text truncate="end" title={c.getValue().join(", ")}>
        {c.getValue().join(", ")}
      </Text>
    ),
  }),
  col.accessor("status", {
    header: "ステータス",
    size: 120,
    cell: (c) => <StatusBadge status={c.getValue()} />,
  }),
  col.accessor("amazonUrl", {
    header: "Amazon",
    size: 220,
    enableSorting: false,
    cell: (c) => {
      const amazonUrl = c.getValue();

      return amazonUrl === null ? null : (
        <Anchor
          href={amazonUrl}
          target="_blank"
          rel="noreferrer"
          truncate="end"
          title={amazonUrl}
          display="block"
        >
          {amazonUrl}
        </Anchor>
      );
    },
  }),
  col.accessor("pageUrl", {
    header: "Notion",
    size: 140,
    enableSorting: false,
    cell: (c) => (
      <Anchor href={c.getValue()} target="_blank" rel="noreferrer" size="sm">
        Notion で開く ↗
      </Anchor>
    ),
  }),
  col.accessor("highlightCount", { header: "ハイライト", size: 96 }),
  col.accessor("lastUpdated", {
    header: "最終更新",
    size: 116,
    cell: (c) => {
      const lastUpdated = c.getValue();

      return lastUpdated === null ? "—" : format(lastUpdated, "YYYY/MM/DD");
    },
  }),
];

export function BooksTable({ data }: Record<"data", BookRowValues[]>) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "lastUpdated", desc: true }]);
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
    // 高さは親（レイアウトの残り領域）が決める。ここでスクロールを閉じる
    <div ref={parentRef} className="h-full overflow-auto">
      <Table stickyHeader highlightOnHover layout="fixed">
        <Table.Thead>
          {table.getHeaderGroups().map((hg) => (
            <Table.Tr key={hg.id}>
              {hg.headers.map((h) => (
                <Table.Th
                  key={h.id}
                  bg="blue.0"
                  c="blue.9"
                  onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                  w={h.getSize()}
                  className={h.column.getCanSort() ? "cursor-pointer" : undefined}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {sortMark(h.column.getIsSorted())}
                </Table.Th>
              ))}
            </Table.Tr>
          ))}
        </Table.Thead>
        <Table.Tbody className="relative" h={virtualizer.getTotalSize()}>
          {virtualizer.getVirtualItems().map((vi) => {
            const row = rows[vi.index];

            if (!row) {
              return null;
            }

            const zebra = vi.index % 2 === 1;

            return (
              <Table.Tr
                key={row.id}
                bg={zebra ? "gray.0" : undefined}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                // 仮想化のため各行を絶対配置し、table-fixed で列幅を親と揃える
                className="absolute table w-full table-fixed"
                style={{ transform: `translateY(${vi.start}px)` }}
              >
                {row.getVisibleCells().map((cell) => (
                  <Table.Td key={cell.id} w={cell.column.getSize()}>
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
